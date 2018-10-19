const config = require('../config.json')
const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds // Directory of guild profiles (Map)
const checkGuild = require('./checkGuild.js')
const configChecks = require('./configCheck.js')
const LinkTracker = require('../structs/LinkTracker.js')
const dbOps = require('./dbOps.js')
const log = require('./logger.js')
const FAIL_LIMIT = config.feeds.failLimit

function reachedFailCount (link) {
  const failed = typeof storage.failedLinks[link] === 'string' || (typeof storage.failedLinks[link] === 'number' && storage.failedLinks[link] >= FAIL_LIMIT) // string indicates it has reached the fail count, and is the date of when it failed
  if (failed && config.log.failedFeeds !== false) log.init.warning('Feeds with link', link, 'will be skipped due to reaching fail limit (', FAIL_LIMIT, ')')
  return failed
}

module.exports = async (bot, customSchedules, callback) => {
  const currentCollections = [] // currentCollections is only used if there is no sharding (for database cleaning)
  const linkTracker = new LinkTracker([], bot)
  const SHARD_ID = bot.shard && bot.shard.count > 0 ? 'SH ' + bot.shard.id + ' ' : ''
  const guildsInfo = {}
  const missingGuilds = {}
  const scheduleRssNameDir = {}
  const scheduleWordDir = {}
  const activeSourcesForTracker = []
  let feedData
  if (!config.database.uri.startsWith('mongo')) feedData = {} // Object of collection ids as keys, and arrays of objects as values

  // Set up custom schedules
  if (customSchedules) {
    for (var w = 0; w < customSchedules.length; ++w) {
      const schedule = customSchedules[w]
      const scheduleName = schedule.name
      const keywords = schedule.keywords
      const rssNames = schedule.rssNames
      scheduleWordDir[scheduleName] = []
      for (var schedKeyword of keywords) {
        storage.allScheduleWords.push(schedKeyword)
        scheduleWordDir[scheduleName].push(schedKeyword)
      }
      if (rssNames) {
        scheduleRssNameDir[scheduleName] = []
        for (var schedRssName of rssNames) {
          storage.allScheduleRssNames.push(schedRssName)
          scheduleRssNameDir[scheduleName].push(schedRssName)
        }
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
  const docs = await dbOps.blacklists.get()
  for (var d = 0; d < docs.length; ++d) {
    const blisted = docs[d]
    if (blisted.isGuild) storage.blacklistGuilds.push(blisted.id)
    else storage.blacklistUsers.push(blisted.id)
  }

  await dbOps.failedLinks.initialize()

  // Cache guilds
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
    const rssList = guildRss.sources
    for (var rssName in rssList) {
      const source = rssList[rssName]

      // Assign feeds to specific schedules in scheduleAssigned for use by feedSchedules by rssNames first

      if (Object.keys(scheduleRssNameDir).length > 0) {
        for (var scheduleName1 in scheduleRssNameDir) {
          const rssNameList = scheduleRssNameDir[scheduleName1]
          if (rssNameList.includes(rssName) && !storage.scheduleAssigned[rssName]) {
            log.init.info(`${SHARD_ID}Assigning feed ${rssName} to schedule ${scheduleName1} by rssName`)
            storage.scheduleAssigned[rssName] = scheduleName1
          }
        }
      }

      // Then by keywords
      if (Object.keys(scheduleWordDir).length > 0) {
        for (var scheduleName2 in scheduleWordDir) {
          const wordList = scheduleWordDir[scheduleName2]
          wordList.forEach(item => {
            if (source.link.includes(item) && !storage.scheduleAssigned[rssName]) {
              log.init.info(`${SHARD_ID}Assigning feed ${rssName} to schedule ${scheduleName2} by keyword`)
              storage.scheduleAssigned[rssName] = scheduleName2 // Assign a schedule to a feed if it doesn't already exist in the scheduleAssigned to another schedule
            }
          })
        }
        if (!storage.scheduleAssigned[rssName]) storage.scheduleAssigned[rssName] = 'default' // Assign to default schedule if it wasn't assigned to a custom schedule
      }

      if (configChecks.checkExists(rssName, guildRss, true, true) && configChecks.validChannel(bot, guildRss, rssName) && !reachedFailCount(source.link)) activeSourcesForTracker.push({ link: source.link, rssName: rssName })
    }
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

  async function checkVIPs () {
    try {
      // For patron tracking on the public bot
      if (config.database.uri.startsWith('mongo') && config._vip) {
        await require('../settings/vips.js')(bot)
        dbOps.vips.refreshVipSchedule(true, true) // Only assign schedules and nothing more to let linkTracker generate collection ids for database cleaning
        finish()
      } else finish()
    } catch (e) {
      if (config._vip) log.general.error(`Failed to load VIP module`, e, true)
      finish()
    }
  }

  function finish () {
    const linkTrackerArr = linkTracker.toDocs()
    for (var obj of linkTrackerArr) {
      // if (config.database.clean !== true) {
      if (config.database.articlesExpire === 0) {
        dbOps.feeds.dropIndexes(obj.link, linkTracker.shardId, obj.scheduleName).catch(err => {
          if (err.code !== 26) log.init.warning(`Unable to drop indexes for Feed collection ${obj.link}:`, err)
        })
      }
    }

    for (var item of activeSourcesForTracker) {
      const collectionId = storage.collectionId(item.link, bot.shard && bot.shard.count > 0 ? bot.shard.id : undefined, storage.scheduleAssigned[item.rssName])
      linkTracker.increment(item.link, storage.scheduleAssigned[item.rssName])
      if ((!bot.shard || bot.shard.count === 0) && !currentCollections.includes(collectionId)) currentCollections.push(collectionId)
    }

    log.init.info(`${SHARD_ID}Finished initialization`)
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
