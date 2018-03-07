const fs = require('fs')
const config = require('../config.json')
const initAll = require('../rss/initSingle.js')
const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds // Directory of guild profiles (Map)
const linkTracker = storage.linkTracker // Directory of all feeds, used to track between multiple feed schedules
const allScheduleWords = storage.allScheduleWords // Directory of all words defined across all schedules
const failedLinks = storage.failedLinks
const feedLinkList = storage.linkList
const checkGuild = require('./checkGuild.js')
const sendToDiscord = require('./sendToDiscord.js')
const process = require('child_process')
const configChecks = require('./configCheck.js')
const fileOps = require('./fileOps.js')
const log = require('./logger.js')
const GuildRss = storage.models.GuildRss()
const FAIL_LIMIT = config.feedSettings.failLimit

function addFailedFeed (link) {
  failedLinks[link] = failedLinks[link] ? failedLinks[link] + 1 : 1
}

function reachedFailCount (link) {
  const failed = typeof failedLinks[link] === 'string' || (typeof failedLinks[link] === 'number' && failedLinks[link] >= FAIL_LIMIT) // string indicates it has reached the fail count, and is the date of when it failed
  if (failed && config.logging.showFailedFeeds !== false) log.init.warning(`Feeds with link ${link} will be skipped due to reaching fail limit (${FAIL_LIMIT})`)
  return failed
}

// Callback for messages sent to Discord
function discordMsgResult (err, article, bot) {
  const channel = bot.channels.get(article.discordChannelId)
  if (err) {
    log.init.warning(`Failed to deliver article ${article.link}`, channel.guild, channel, err)
    if (err.code === 50035 && config._skipMessages !== true) channel.send(`Failed to send formatted article for article <${article.link}> due to misformation.\`\`\`${err.message}\`\`\``)
  }
}

module.exports = (bot, callback) => {
  const SHARD_ID = bot.shard ? 'SH ' + bot.shard.id + ' ' : ''
  const modSourceList = new Map()
  const sourceList = new Map()
  const regBatchList = []
  const modBatchList = []
  const batchSize = 400
  const guildsInfo = {}

  let cycleFailCount = 0
  let cycleTotalCount = 0

  try {
    var scheduleWordDir = {}
    const schedules = fs.readdirSync('./settings/schedules') // Record all words in schedules for later use by FeedSchedules
    if (schedules.length === 1 && schedules[0] === 'exampleSchedule.json') log.init.info(`${SHARD_ID}No custom schedules detected`)
    for (var i in schedules) {
      if (schedules[i] !== 'exampleSchedule.json') {
        const schedule = JSON.parse(fs.readFileSync(`./settings/schedules/${schedules[i]}`))
        if (!schedule.refreshTimeMinutes || typeof schedule.keywords !== 'object' || !schedule.keywords.length || schedule.keywords.length === 0) throw new Error(`Schedule named '${schedules[i]}' is improperly configured.`)

        const scheduleName = schedules[i].replace(/\.json/gi, '')

        scheduleWordDir[scheduleName] = []
        schedule.keywords.forEach(item => {
          allScheduleWords.push(item)
          scheduleWordDir[scheduleName].push(item)
        })
      }
    }
  } catch (e) {
    log.init.info(`${SHARD_ID}No schedules found due to no schedules folder`)
  }

  // Remove expires index, but ignores the log if it's "ns not found" error (meaning the collection doesn't exist)
  if (config.database.guildBackupsExpire <= 0) {
    storage.models.GuildRssBackup().collection.dropIndexes(err => {
      if (err && err.code !== 26) log.init.warning(`Unable to drop indexes for Guild_Backup collection for`, err)
    })
  }

  // Cache blacklisted users and guilds
  fileOps.getBlacklists((err, docs) => {
    if (err) throw err
    for (var d = 0; d < docs.length; ++d) {
      const blisted = docs[d]
      if (blisted.isGuild) storage.blacklistGuilds.push(blisted.id)
      else storage.blacklistUsers.push(blisted.id)
    }
  })

  // For patron tracking on the public bot
  try { require('../settings/vips.js')(bot) } catch (e) { if (config._server) log.general.error(`Failed to load VIP module`, e) }

  // Cache guilds and start initialization
  GuildRss.find((err, results) => {
    if (err) throw err
    for (var r = 0; r < results.length; ++r) {
      const guildRss = results[r]
      const guildId = guildRss.id
      const rssList = guildRss.sources
      if (!bot.guilds.has(guildId)) { // Check if it is a valid guild in bot's guild collection
        if (bot.shard) bot.shard.send({type: 'missingGuild', content: guildId})
        else {
          fileOps.deleteGuild(guildId, null, err => {
            if (err) return log.init.warning(`(G: ${guildId}) Guild deletion from database error based on missing guild`, err)
            log.init.info(`(G: ${guildId}) Guild is missing and has been removed and backed up`)
          })
        }
        continue
      }
      if (fileOps.isEmptySources(guildRss)) continue
      if (!currentGuilds.has(guildId) || JSON.stringify(currentGuilds.get(guildId)) !== JSON.stringify(guildRss)) {
        currentGuilds.set(guildId, guildRss)
        checkGuild.names(bot, guildId)
      }
      guildsInfo[guildId] = guildRss
      addToSourceLists(rssList, guildId)
    }

    if (sourceList.size + modSourceList.size === 0) {
      log.init.info(`${SHARD_ID}There are no active feeds to initialize`)
      return finishInit()
    }
    return connect()
  })

  function genBatchLists () {
    let batch = new Map()

    sourceList.forEach((rssList, link) => { // rssList per link
      if (batch.size >= batchSize) {
        regBatchList.push(batch)
        batch = new Map()
      }
      batch.set(link, rssList)
    })

    if (batch.size > 0) regBatchList.push(batch)

    batch = new Map()

    modSourceList.forEach((source, link) => { // One RSS source per link instead of an rssList
      if (batch.size >= batchSize) {
        modBatchList.push(batch)
        batch = new Map()
      }
      batch.set(link, source)
    })

    if (batch.size > 0) modBatchList.push(batch)
  }

  function addToSourceLists (rssList, guildId) { // rssList is an object per guildRss
    for (var rssName in rssList) {
      const source = rssList[rssName]
      feedLinkList.push(source.link) // Duplicates are necessary for every feed
      const Article = storage.models.Article(rssName)
      if (config.database.clean !== true) {
        Article.collection.dropIndexes(err => {
          if (err && err.code !== 26) log.init.warning(`Unable to drop indexes Article collection ${rssName}:`, err)
        })
      }
      if (configChecks.checkExists(rssName, source, true, true) && configChecks.validChannel(bot, guildId, source) && !reachedFailCount(source.link)) {
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

        // Assign feeds to specific schedules in linkTracker for use by feedSchedules
        if (scheduleWordDir && Object.keys(scheduleWordDir).length > 0) {
          for (var scheduleName in scheduleWordDir) {
            let wordList = scheduleWordDir[scheduleName]
            wordList.forEach(item => {
              if (source.link.includes(item) && !linkTracker[rssName]) {
                log.init.info(`${SHARD_ID}Assigning feed ${rssName} to schedule ${scheduleName}`)
                linkTracker[rssName] = scheduleName // Assign a schedule to a feed if it doesn't already exist in the linkTracker to another schedule
              }
            })
          }
          if (!linkTracker[rssName]) linkTracker[rssName] = 'default' // Assign to default schedule if it wasn't assigned to a custom schedule
        }
      }
    }
  }

  function connect () {
    log.init.info(`${SHARD_ID}Starting initialization cycle`)
    genBatchLists()

    switch (config.advanced.processorMethod) {
      case 'single':
        getBatch(0, regBatchList, 'regular')
        break
      case 'isolated':
        getBatchIsolated(0, regBatchList, 'regular')
        break
      case 'parallel':
        getBatchParallel()
    }
  }

  function getBatch (batchNumber, batchList, type) {
    if (batchList.length === 0) return getBatch(0, modBatchList, 'modded')
    let currentBatch = batchList[batchNumber]
    let completedLinks = 0

    currentBatch.forEach((rssList, link) => { // rssList is an rssList of a specific link
      var uniqueSettings
      for (var modRssName in rssList) {
        if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
          uniqueSettings = rssList[modRssName].advanced
        }
      }

      initAll(link, rssList, uniqueSettings, (err, linkCompletion) => {
        if (err) log.init.error(`Skipping ${linkCompletion.link}`, err)
        if (linkCompletion.status === 'article') return sendToDiscord(bot, linkCompletion.article, err => discordMsgResult(err, linkCompletion.article, bot)) // This can result in great spam once the loads up after a period of downtime
        if (linkCompletion.status === 'failed' && FAIL_LIMIT !== 0) addFailedFeed(linkCompletion.link)
        if (linkCompletion.status === 'success' && failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]

        completedLinks++
        log.init.info(`${SHARD_ID}Batch ${batchNumber + 1} (${type}) Progress: ${completedLinks}/${currentBatch.size}`)
        if (completedLinks === currentBatch.size) {
          if (batchNumber !== batchList.length - 1) setTimeout(getBatch, 200, batchNumber + 1, batchList, type)
          else if (type === 'regular' && modBatchList.length > 0) setTimeout(getBatch, 200, 0, modBatchList, 'modded')
          else return finishInit()
        }
      })
    })
  }

  function getBatchIsolated (batchNumber, batchList, type) {
    if (batchList.length === 0) return getBatchIsolated(0, modBatchList, 'modded')
    let completedLinks = 0
    let currentBatch = batchList[batchNumber]

    const processor = process.fork('./rss/initProcessor.js')

    currentBatch.forEach((rssList, link) => {
      var uniqueSettings
      for (var modRssName in rssList) {
        if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
          uniqueSettings = rssList[modRssName].advanced
        }
      }
      processor.send({link: link, rssList: rssList, uniqueSettings: uniqueSettings})
    })

    processor.on('message', linkCompletion => {
      if (linkCompletion.status === 'fatal') {
        if (bot.shard) bot.shard.broadcastEval('process.exit()')
        throw linkCompletion.err // Full error is printed from the processor
      }
      if (linkCompletion.status === 'article') return sendToDiscord(bot, linkCompletion.article, err => discordMsgResult(err, linkCompletion.article, bot)) // This can result in great spam once the loads up after a period of downtime
      if (linkCompletion.status === 'failed') {
        cycleFailCount++
        if (FAIL_LIMIT !== 0) addFailedFeed(linkCompletion.link)
      }
      if (linkCompletion.status === 'success' && failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]

      completedLinks++
      cycleTotalCount++
      log.init.info(`${SHARD_ID}Batch ${batchNumber + 1} (${type}) Progress: ${completedLinks}/${currentBatch.size}`)

      if (completedLinks === currentBatch.size) {
        if (batchNumber !== batchList.length - 1) setTimeout(getBatchIsolated, 200, batchNumber + 1, batchList, type)
        else if (type === 'regular' && modBatchList.length > 0) setTimeout(getBatchIsolated, 200, 0, modBatchList, 'modded')
        else finishInit()
        processor.kill()
      }
    })
  }

  function getBatchParallel () {
    let totalBatchLengths = regBatchList.length + modBatchList.length
    let totalLinks = 0
    for (var x in regBatchList) {
      totalLinks += regBatchList[x].size
    }
    for (var y in modBatchList) {
      totalLinks += modBatchList[y].size
    }
    let completedBatches = 0
    let totalCompletedLinks = 0

    function deployProcessors (batchList, index) {
      let completedLinks = 0

      const processor = process.fork('./rss/initProcessor.js')
      let currentBatch = batchList[index]

      processor.on('message', linkCompletion => {
        if (linkCompletion.status === 'kill') {
          if (bot.shard) bot.shard.broadcastEval('process.exit()')
          throw linkCompletion.err // Full error is printed from the processor
        }
        if (linkCompletion.status === 'article') return sendToDiscord(bot, linkCompletion.article, err => discordMsgResult(err, linkCompletion.article, bot)) // This can result in great spam once the loads up after a period of downtime
        if (linkCompletion.status === 'failed' && FAIL_LIMIT !== 0) addFailedFeed(linkCompletion.link)
        if (linkCompletion.status === 'success' && failedLinks[linkCompletion.link]) delete failedLinks[linkCompletion.link]

        completedLinks++
        totalCompletedLinks++
        log.init.info(`${SHARD_ID}Parallel Progress: ${totalCompletedLinks}/${totalLinks}`)
        if (completedLinks === currentBatch.size) {
          completedBatches++
          processor.kill()
          if (completedBatches === totalBatchLengths) finishInit()
        }
      })

      currentBatch.forEach((rssList, link) => {
        var uniqueSettings
        for (var modRssName in rssList) {
          if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
            uniqueSettings = rssList[modRssName].advanced
          }
        }
        processor.send({link: link, rssList: rssList, uniqueSettings: uniqueSettings})
      })
    }

    for (var i in regBatchList) { deployProcessors(regBatchList, i) }
    for (var j in modBatchList) { deployProcessors(modBatchList, j) }
  }

  function finishInit () {
    log.init.info(`${SHARD_ID}INIT Info: Finished initialization cycle ${cycleFailCount > 0 ? ' (' + cycleFailCount + '/' + cycleTotalCount + ' failed)' : ''}`)

    if (bot.shard) bot.shard.send({ type: 'updateFailedLinks', failedLinks: failedLinks })
    else try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (err) { log.general.warning(`Unable to update failedLinks.json on end of initialization`, err) }

    callback(guildsInfo)
  }
}
