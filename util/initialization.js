const config = require('../config.js')
const storage = require('./storage.js')
const checkGuild = require('./checkGuild.js')
const LinkTracker = require('../structs/LinkTracker.js')
const dbOps = require('./dbOps.js')
const log = require('./logger.js')
const redisOps = require('./redisOps.js')
const assignedSchedules = require('./assignedSchedules.js')
const FAIL_LIMIT = config.feeds.failLimit

function reachedFailCount (link, failedLinks) {
  const failed = typeof failedLinks[link] === 'string' || (typeof failedLinks[link] === 'number' && failedLinks[link] >= FAIL_LIMIT) // string indicates it has reached the fail count, and is the date of when it failed
  if (failed && config.log.failedFeeds !== false) log.init.warning(`Feeds with link ${link} will be skipped due to reaching fail limit (${FAIL_LIMIT})`)
  return failed
}

module.exports = async (bot, callback, vipApiData) => {
  const currentCollections = [] // currentCollections is only used if there is no sharding (for database cleaning)
  const linkTracker = new LinkTracker([], bot)
  const SHARD_ID = bot.shard && bot.shard.count > 0 ? 'SH ' + bot.shard.id + ' ' : ''
  const guildsInfo = {}
  const missingGuilds = {}
  const activeSourcesForTracker = []

  // Remove expires index, but ignores the log if it's "ns not found" error (meaning the collection doesn't exist)
  if (config.database.guildBackupsExpire <= 0) {
    dbOps.guildRssBackup.dropIndexes().catch(err => {
      if (err.code !== 26) log.init.warning(`Unable to drop indexes for Guild_Backup collection for`, err)
    })
  }

  // Cache blacklisted users and guilds
  const docs = await dbOps.blacklists.getAll()
  for (var d = 0; d < docs.length; ++d) {
    const blisted = docs[d]
    if (blisted.isGuild) storage.blacklistGuilds.push(blisted.id)
    else storage.blacklistUsers.push(blisted.id)
  }
  const failedLinks = {}
  const failedLinksArr = await dbOps.failedLinks.getAll()
  failedLinksArr.forEach(item => {
    failedLinks[item.link] = item.failed || item.count
  })

  // Remove missing guilds and empty guildRsses, along with other checks
  const guildRssList = await dbOps.guildRss.getAll()
  const versionCheckPromises = []
  for (var r = 0; r < guildRssList.length; ++r) {
    const guildRss = guildRssList[r]
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
    if (guildRss.prefix) storage.prefixes[guildId] = guildRss.prefix
    if (dbOps.guildRss.empty(guildRss)) continue
    checkGuild.subscriptions(bot, guildRss)
    versionCheckPromises.push(checkGuild.version(guildRss))

    guildsInfo[guildId] = guildRss
    const rssList = guildRss.sources
    for (var rssName in rssList) {
      const source = rssList[rssName]
      // Assign feeds to specific schedules in assignedSchedules for use by feedSchedules by rssNames first
      if (checkGuild.config(bot, guildRss, rssName, true) && !reachedFailCount(source.link, failedLinks)) activeSourcesForTracker.push({ link: source.link, rssName: rssName, server: guildId })
    }
  }

  let c = 0
  const total = bot.guilds.size

  // Redis is only for UI use
  Promise.all(versionCheckPromises).then(() => {
    bot.guilds.forEach((guild, guildId) => {
      redisOps.guilds.recognize(guild).catch(err => {
        // This will recognize all guild info, members, channels and roles
        throw err
      })
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
  }).catch(err => {
    throw err
  })

  if (redisOps.client.exists()) {
    bot.users.forEach(user => {
      redisOps.users.recognize(user).catch(err => {
        if (err) throw err
      })
    })
  }

  if (total === 0) checkVIPs()

  async function checkVIPs () {
    try {
      // For patron tracking on the public bot
      if (config.database.uri.startsWith('mongo') && config._vip) {
        const vipServers = await require('../settings/vips.js')(bot, vipApiData)
        finish(vipServers)
      } else finish()
    } catch (e) {
      if (config._vip) log.general.error(`Failed to load VIP module`, e, true)
      finish()
    }
  }

  function finish (vipServers = []) {
    const linkTrackerArr = linkTracker.toDocs()
    for (var obj of linkTrackerArr) {
      if (config.database.articlesExpire === 0) {
        dbOps.feeds.dropIndexes(obj.link, linkTracker.shardId, obj.scheduleName).catch(err => {
          if (err.code !== 26) log.init.warning(`Unable to drop indexes for Feed collection ${obj.link}:`, err)
        })
      }
    }

    // Decides what collections get removed from database later on
    for (const item of activeSourcesForTracker) {
      const itemSchedule = vipServers.includes(item.server) ? 'vip' : assignedSchedules.getScheduleName(item.rssName)
      const collectionId = storage.collectionId(item.link, bot.shard && bot.shard.count > 0 ? bot.shard.id : undefined, itemSchedule)
      linkTracker.increment(item.link, itemSchedule)
      if ((!bot.shard || bot.shard.count === 0) && !currentCollections.includes(collectionId)) currentCollections.push(collectionId)
    }

    log.init.info(`${SHARD_ID}Finished initialization`)
    if (!bot.shard || bot.shard.count === 0) {
      if (config.database.uri.startsWith('mongo')) dbOps.statistics.clear().catch(err => err.code === 26 ? null : log.general.warning('Unable to drop statistics database', err)) // 26 is ns not found - it's fine if it didn't exist in the first place
      dbOps.linkTracker.write(linkTracker).catch(err => log.general.warning('Unable to write link tracker links to collection after initialization', err)) // If this is a shard, then it's handled by the sharding manager
      dbOps.general.cleanDatabase(currentCollections)
        .then(() => callback(missingGuilds, linkTracker.toDocs()))
        .catch(err => {
          log.general.error(`Unable to clean database`, err)
          callback(missingGuilds, linkTracker.toDocs())
        })
    } else callback(missingGuilds, linkTracker.toDocs())
  }
}
