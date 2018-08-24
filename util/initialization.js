const config = require('../config.json')
const initAll = require('../rss/singleMethod.js')
const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds // Directory of guild profiles (Map)
const scheduleAssigned = storage.scheduleAssigned // Directory of all feeds, used to track between multiple feed schedules
const allScheduleWords = storage.allScheduleWords // Directory of all words defined across all schedules
const checkGuild = require('./checkGuild.js')
const ArticleMessageQueue = require('../structs/ArticleMessageQueue.js')
const childProcess = require('child_process')
const configChecks = require('./configCheck.js')
const LinkTracker = require('../structs/LinkTracker.js')
const dbOps = require('./dbOps.js')
const log = require('./logger.js')
const FAIL_LIMIT = config.feeds.failLimit

function reachedFailCount (link) {
  const failed = typeof storage.failedLinks[link] === 'string' || (typeof storage.failedLinks[link] === 'number' && storage.failedLinks[link] >= FAIL_LIMIT) // string indicates it has reached the fail count, and is the date of when it failed
  if (failed && config.log.failedFeeds !== false) log.init.warning(`Feeds with link ${link} will be skipped due to reaching fail limit (${FAIL_LIMIT})`)
  return failed
}

module.exports = (bot, customSchedules, callback) => {
  const articleMessageQueue = new ArticleMessageQueue()
  const currentCollections = [] // currentCollections is only used if there is no sharding (for database cleaning)
  const linkTracker = new LinkTracker([], bot)
  const SHARD_ID = bot.shard && bot.shard.count > 0 ? 'SH ' + bot.shard.id + ' ' : ''
  const modSourceList = new Map()
  const sourceList = new Map()
  const regBatchList = []
  const modBatchList = []
  const BATCH_SIZE = 400
  const guildsInfo = {}
  const missingGuilds = {}
  const scheduleWordDir = {}
  let feedData
  if (!config.database.uri.startsWith('mongo')) feedData = {} // Object of collection ids as keys, and arrays of objects as values

  let cycleFailCount = 0
  let cycleTotalCount = 0

  // Set up custom schedules
  if (customSchedules) {
    for (var w = 0; w < customSchedules.length; ++w) {
      const schedule = customSchedules[w]
      const scheduleName = schedule.name
      const keywords = schedule.keywords
      scheduleWordDir[scheduleName] = []
      for (var e = 0; e < keywords.length; ++e) {
        const word = keywords[e]
        allScheduleWords.push(word)
        scheduleWordDir[scheduleName].push(word)
      }
    }
  }

  // Remove expires index, but ignores the log if it's "ns not found" error (meaning the collection doesn't exist)
  if (config.database.guildBackupsExpire <= 0) {
    dbOps.guildRssBackup.dropIndexes().catch(err => {
      if (err.code !== 26) log.init.warning(`Unable to drop indexes for Guild_Backup collection for`, err)
    })
  }

  // Cache blacklisted users and guilds
  dbOps.blacklists.get()
    .then(docs => {
      for (var d = 0; d < docs.length; ++d) {
        const blisted = docs[d]
        if (blisted.isGuild) storage.blacklistGuilds.push(blisted.id)
        else storage.blacklistUsers.push(blisted.id)
      }
    })
    .catch(err => {
      console.log(err)
      process.exit(1)
    })

  dbOps.failedLinks.initialize()
    .then(() => readGuilds())
    .catch(err => {
      console.log(err)
      process.exit(1)
    })

  // Cache guilds and start initialization
  async function readGuilds () {
    try {
      const results = await dbOps.guildRss.getAll()
      for (var r = 0; r < results.length; ++r) {
        const guildRss = results[r]
        const guildId = guildRss.id
        if (!bot.guilds.has(guildId)) { // Check if it is a valid guild in bot's guild collection
          if (bot.shard && bot.shard.count > 0) missingGuilds[guildId] = guildRss
          else {
            dbOps.guildRss.remove(guildRss, true)
              .then(() => {
                log.init.info(`(G: ${guildId}) Removed missing guild`)
              })
              .catch(err => {
                if (err) return log.init.warning(`(G: ${guildId}) Guild deletion from database error based on missing guild`, err)
              })
          }
          continue
        }
        if (dbOps.guildRss.empty(guildRss)) continue
        if (!currentGuilds.has(guildId) || JSON.stringify(currentGuilds.get(guildId)) !== JSON.stringify(guildRss)) {
          currentGuilds.set(guildId, guildRss)
          checkGuild.names(bot, guildId)
        }
        guildsInfo[guildId] = guildRss
        addToSourceLists(guildRss)
      }

      let c = 0
      const total = bot.guilds.size
      if (total === 0) checkVIPs()
      bot.guilds.forEach((guild, guildId) => {
        if (guildsInfo[guildId]) {
          if (++c === total) checkVIPs()
          return
        }
        const id = guildId
        dbOps.guildRss.restore(guildId, true).then(guildRss => {
          if (guildRss) log.init.info(`Restored profile for ${guildRss.id}`)
          if (++c === total) checkVIPs()
        }).catch(err => {
          log.init.info(`Unable to restore ${id}`, err)
          if (++c === total) checkVIPs()
        })
      })
    } catch (err) {
      console.log(err)
      process.exit(1)
    }
  }

  function addToSourceLists (guildRss) { // rssList is an object per guildRss
    const guildId = guildRss.id
    const rssList = guildRss.sources
    for (var rssName in rssList) {
      const source = rssList[rssName]
      if (!bot.shard || bot.shard.count === 0) {
        const collectionId = storage.collectionId(source.link)
        if (!currentCollections.includes(collectionId)) currentCollections.push(collectionId)
      }
      linkTracker.increment(source.link)
      if (configChecks.checkExists(rssName, guildRss, true, true) && configChecks.validChannel(bot, guildRss, rssName) && !reachedFailCount(source.link)) {
        checkGuild.roles(bot, guildId, rssName) // Check for any role name changes

        if (source.advanced && Object.keys(source.advanced).length > 0) { // Special source list for feeds with unique settings defined, each linkList only has 1 item
          let linkList = {}
          linkList[rssName] = source
          modSourceList.set(source.link, linkList)
        } else if (sourceList.has(source.link)) { // Regular source lists, optimized for faster operation by aggregating feeds of same links
          let linkList = sourceList.get(source.link)
          linkList[rssName] = source
        } else {
          let linkList = {}
          linkList[rssName] = source
          sourceList.set(source.link, linkList)
        }

        // Assign feeds to specific schedules in scheduleAssigned for use by feedSchedules
        if (scheduleWordDir && Object.keys(scheduleWordDir).length > 0) {
          for (var scheduleName in scheduleWordDir) {
            let wordList = scheduleWordDir[scheduleName]
            wordList.forEach(item => {
              if (source.link.includes(item) && !scheduleAssigned[rssName]) {
                log.init.info(`${SHARD_ID}Assigning feed ${rssName} to schedule ${scheduleName}`)
                scheduleAssigned[rssName] = scheduleName // Assign a schedule to a feed if it doesn't already exist in the scheduleAssigned to another schedule
              }
            })
          }
          if (!scheduleAssigned[rssName]) scheduleAssigned[rssName] = 'default' // Assign to default schedule if it wasn't assigned to a custom schedule
        }
      }
    }
  }

  async function checkVIPs () {
    try {
      // For patron tracking on the public bot
      if (config.database.uri.startsWith('mongo') && config._vip && ((!bot.shard || bot.shard.count === 0) || (bot.shard && bot.shard.id === bot.shard.count - 1))) {
        await require('../settings/vips.js')(bot)
        prepConnect()
      } else prepConnect()
    } catch (e) {
      if (config._vip) log.general.error(`Failed to load VIP module`, e)
      prepConnect()
    }
  }

  function prepConnect () {
    const linkTrackerArr = linkTracker.toArray()
    for (var t in linkTrackerArr) {
      const link = linkTrackerArr[t]
      if (config.database.clean !== true) {
        dbOps.feeds.dropIndexes(link, linkTracker.shardId).catch(err => {
          if (err.code !== 26) log.init.warning(`Unable to drop indexes for Feed collection ${link}:`, err)
        })
      }
    }

    // Finally connect and run through the batches
    if (sourceList.size + modSourceList.size === 0) {
      log.init.info(`${SHARD_ID}There are no active feeds to initialize`)
      return finishInit()
    }
    return connect()
  }

  function genBatchLists () {
    let batch = {}

    sourceList.forEach((rssList, link) => { // rssList per link
      if (Object.keys(batch).length >= BATCH_SIZE) {
        regBatchList.push(batch)
        batch = {}
      }
      batch[link] = rssList
    })
    if (Object.keys(batch).length > 0) regBatchList.push(batch)

    batch = {}

    modSourceList.forEach((source, link) => { // One RSS source per link instead of an rssList
      if (Object.keys(batch).length >= BATCH_SIZE) {
        modBatchList.push(batch)
        batch = {}
      }
      batch[link] = source
    })
    if (Object.keys(batch).length > 0) modBatchList.push(batch)
  }

  function connect () {
    log.init.info(`${SHARD_ID}Starting initialization cycle`)
    genBatchLists()
    switch (config.advanced.processorMethod) {
      case 'concurrent':
        getBatch(0, regBatchList, 'regular')
        break
      case 'concurrent-isolated':
        getBatchIsolated(0, regBatchList, 'regular')
        break
      case 'parallel-isolated':
        getBatchParallel()
    }
  }

  function getBatch (batchNumber, batchList, type) {
    if (batchList.length === 0) return getBatch(0, modBatchList, 'modded')
    const currentBatch = batchList[batchNumber]
    const currentBatchLen = Object.keys(currentBatch).length
    let completedLinks = 0

    for (var link in currentBatch) {
      const rssList = currentBatch[link] // rssList is an rssList of a specific link
      let uniqueSettings
      for (var modRssName in rssList) {
        if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
          uniqueSettings = rssList[modRssName].advanced
        }
      }

      initAll({ config: config, feedData: feedData, link: link, rssList: rssList, uniqueSettings: uniqueSettings, logicType: 'init' }, (err, linkCompletion) => {
        if (err) log.init.warning(`Skipping ${linkCompletion.link}`, err, true)
        if (linkCompletion.status === 'article') return articleMessageQueue.send(linkCompletion.article).catch(err => log.general.warning('articleMessageQueue initialization', err))
        if (linkCompletion.status === 'failed') dbOps.failedLinks.increment(linkCompletion.link, true).catch(err => log.general.warning(`Unable to increment failed link ${linkCompletion.link}`, err))
        else if (linkCompletion.status === 'success') {
          dbOps.failedLinks.reset(linkCompletion.link, true).catch(err => log.general.warning(`Unable to reset failed link ${linkCompletion.link}`, err))
          if (linkCompletion.feedCollectionId) feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection
        }

        completedLinks++
        log.init.info(`${SHARD_ID}Batch ${batchNumber + 1} (${type}) Progress: ${completedLinks}/${currentBatchLen}`)
        if (completedLinks === currentBatchLen) {
          if (batchNumber !== batchList.length - 1) setTimeout(getBatch, 200, batchNumber + 1, batchList, type)
          else if (type === 'regular' && modBatchList.length > 0) setTimeout(getBatch, 200, 0, modBatchList, 'modded')
          else return finishInit()
        }
      })
    }
  }

  let batchTracker = {}

  function getBatchIsolated (batchNumber, batchList, type) {
    if (batchList.length === 0) return getBatchIsolated(0, modBatchList, 'modded')
    let completedLinks = 0
    const currentBatch = batchList[batchNumber]
    const currentBatchLen = Object.keys(currentBatch).length

    const processor = childProcess.fork('./rss/isolatedMethod.js')

    processor.on('message', linkCompletion => {
      if (linkCompletion.status === 'article') return articleMessageQueue.send(linkCompletion.article).catch(err => log.general.warning('articleMessageQueue initialization', err))
      if (linkCompletion.status === 'batch_connected') return // Only used for parallel
      if (linkCompletion.status === 'success') {
        dbOps.failedLinks.reset(linkCompletion.link, true).catch(err => log.general.warning(`Unable to reset failed link ${linkCompletion.link}`, err))
        if (linkCompletion.feedCollectionId) feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection
      } else if (linkCompletion.status === 'failed') {
        cycleFailCount++
        if (!bot.shard || bot.shard.count === 0) dbOps.failedLinks.increment(linkCompletion.link, true).catch(err => log.general.warning(`Unable to increment failed link ${linkCompletion.link}`, err)) // Only increment failedLinks if not sharded since failure alerts cannot be sent out when other shards haven't been initialized
      }
      if (linkCompletion.link) batchTracker[linkCompletion.link] = true

      completedLinks++
      cycleTotalCount++
      log.init.info(`${SHARD_ID}Batch ${batchNumber + 1} (${type}) Progress: ${completedLinks}/${currentBatchLen}`)

      if (completedLinks === currentBatchLen) {
        if (batchNumber !== batchList.length - 1) setTimeout(getBatchIsolated, 200, batchNumber + 1, batchList, type)
        else if (type === 'regular' && modBatchList.length > 0) setTimeout(getBatchIsolated, 200, 0, modBatchList, 'modded')
        else finishInit()
        processor.kill()
      }
    })

    processor.send({ config: config, feedData: feedData, currentBatch: currentBatch, shardId: bot.shard && bot.shard.count > 0 ? bot.shard.id : null, logicType: 'init' })
  }

  function getBatchParallel () {
    let totalBatchLengths = regBatchList.length + modBatchList.length
    let totalLinks = 0
    for (var x in regBatchList) totalLinks += Object.keys(regBatchList[x]).length
    for (var y in modBatchList) totalLinks += Object.keys(modBatchList[y]).length
    let completedBatches = 0
    let totalCompletedLinks = 0

    let willCompleteBatch = 0
    let regIndices = []
    let modIndices = []

    function deployProcessor (batchList, index, callback) {
      if (!batchList) return
      let completedLinks = 0

      const processor = childProcess.fork('./rss/isolatedMethod.js')
      const currentBatch = batchList[index]
      const currentBatchLen = Object.keys(currentBatch).length

      processor.on('message', linkCompletion => {
        if (linkCompletion.status === 'article') return articleMessageQueue.send(linkCompletion.article).catch(err => log.general.warning('articleMessageQueue initialization', err))
        if (linkCompletion.status === 'batch_connected') return callback() // Spawn processor for next batch
        if (linkCompletion.status === 'success') {
          dbOps.failedLinks.reset(linkCompletion.link, true).catch(err => log.general.warning(`Unable to reset failed link ${linkCompletion.link}`, err))
          if (linkCompletion.feedCollectionId) feedData[linkCompletion.feedCollectionId] = linkCompletion.feedCollection
        } else if (linkCompletion.status === 'failed') {
          cycleFailCount++
          if (!bot.shard || bot.shard.count === 0) dbOps.failedLinks.increment(linkCompletion.link, true).catch(err => log.general.warning(`Unable to increment failed link ${linkCompletion.link}`, err)) // Only increment failedLinks if not sharded since failure alerts cannot be sent out when other shards haven't been initialized
        }

        completedLinks++
        totalCompletedLinks++
        cycleTotalCount++
        log.init.info(`${SHARD_ID}Parallel Progress: ${totalCompletedLinks}/${totalLinks}`)
        if (completedLinks === currentBatchLen) {
          completedBatches++
          processor.kill()
          if (completedBatches === totalBatchLengths) finishInit()
        }
      })

      processor.send({ config: config, feedData: feedData, currentBatch: currentBatch, shardId: bot.shard && bot.shard.count > 0 ? bot.shard.id : null, logicType: 'init' })
    }

    function spawn (count) {
      for (var q = 0; q < count; ++q) {
        willCompleteBatch++
        deployProcessor(regIndices.length > 0 ? regBatchList : modIndices.length > 0 ? modBatchList : undefined, regIndices.length > 0 ? regIndices.shift() : modIndices.length > 0 ? modIndices.shift() : undefined, () => {
          if (willCompleteBatch < totalBatchLengths) spawn(1)
        })
      }
    }

    if (config.advanced.parallel && config.advanced.parallel > 1) {
      for (var g = 0; g < regBatchList.length; ++g) regIndices.push(g)
      for (var h = 0; h < modBatchList.length; ++h) modIndices.push(h)
      spawn(config.advanced.parallel)
    } else {
      for (var i in regBatchList) { deployProcessor(regBatchList, i) }
      for (var j in modBatchList) { deployProcessor(modBatchList, j) }
    }
  }

  function finishInit () {
    log.init.info(`${SHARD_ID}Finished initialization cycle ${cycleFailCount > 0 ? ' (' + cycleFailCount + '/' + cycleTotalCount + ' failed)' : ''}`)
    if (!bot.shard || bot.shard.count === 0) {
      dbOps.linkTracker.write(linkTracker).catch(err => log.general.warning('Unable to write link tracker links to collection after initialization', err)) // If this is a shard, then it's handled by the sharding manager
      dbOps.general.cleanDatabase(currentCollections)
        .then(() => callback(guildsInfo, missingGuilds, linkTracker.toDocs(), feedData))
        .catch(err => {
          log.general.error(`Unable to clean database`, err)
          callback(guildsInfo, missingGuilds, linkTracker.toDocs(), feedData)
        })
    } else callback(guildsInfo, missingGuilds, linkTracker.toDocs(), feedData)
  }
}
