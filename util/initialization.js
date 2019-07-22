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

module.exports = async (bot, vipApiData) => {
  const currentCollections = [] // currentCollections is only used if there is no sharding (for database cleaning)
  const linkTracker = new LinkTracker([], bot)
  const feedIDs = new Set() // Keep track of rssNames to be sure they are all unique
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
  const updatePromises = []
  // const feedIDUpdatePromises = []
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
    let shouldUpdate = false
    const updatedSubscriptions = await checkGuild.subscriptions(bot, guildRss)
    const updatedVersion = await checkGuild.version(guildRss)
    shouldUpdate = updatedSubscriptions || updatedVersion

    guildsInfo[guildId] = guildRss
    const rssList = guildRss.sources

    for (const rssName in rssList) {
      let id = rssName
      if (!feedIDs.has(rssName)) feedIDs.add(rssName)
      else {
        // duplicate found, update the name
        let newID = rssName + Math.floor((Math.random() * 9) + 1)
        while (feedIDs.has(newID)) {
          newID += Math.floor((Math.random() * 9) + 1)
        }
        Object.defineProperty(rssList, newID, Object.getOwnPropertyDescriptor(rssList, rssName))
        delete rssList[rssName]
        id = newID
        if (!shouldUpdate) shouldUpdate = true
      }
      const source = rssList[id]
      // Assign feeds to specific schedules in assignedSchedules for use by feedSchedules by rssNames first
      if (checkGuild.config(bot, guildRss, id, true) && !reachedFailCount(source.link, failedLinks)) activeSourcesForTracker.push({ link: source.link, rssName: id, server: guildId })
    }

    if (shouldUpdate) updatePromises.push(dbOps.guildRss.update(guildRss))
  }

  let c = 0
  const total = bot.guilds.size

  // Redis is only for UI use
  const redisPromises = []
  const restorePromises = []
  const restorePromisesIDRecord = []

  await Promise.all(updatePromises)
  bot.guilds.forEach((guild, guildId) => {
    redisPromises.push(redisOps.guilds.recognize(guild)) // This will recognize all guild info, members, channels and roles
    if (guildsInfo[guildId]) return  // If the guild profile exists, then mark as completed - otherwise check for backups
    // const id = guildId
    restorePromises.push(dbOps.guildRss.restore(guildId))
    restorePromisesIDRecord.push(guildId)
    // dbOps.guildRss.restore(guildId, true).then(guildRss => {
    //   if (guildRss) log.init.info(`Restored profile for ${guildRss.id}`)
    //   if (++c === total) checkVIPs()
    // }).catch(err => {
    //   log.init.info(`Unable to restore ${id}`, err)
    //   if (++c === total) checkVIPs()
    // })
  })

  if (redisOps.client.exists()) {
    bot.users.forEach(user => redisPromises.push(redisOps.users.recognize(user)))
  }

  await Promise.all(restorePromises)
  await Promise.all(restorePromisesIDRecord)
  await Promise.all(redisPromises)

  let vipServers = []

  try {
    // For patron tracking on the public bot
    if (config.database.uri.startsWith('mongo') && config._vip) {
      vipServers = await require('../settings/vips.js')(bot, vipApiData)
    }
  } catch (e) {
    if (config._vip) log.general.error(`Failed to load VIP module`, e, true)
  }

  const linkTrackerArr = linkTracker.toDocs()
  const dropIndexPromises = []
  for (var obj of linkTrackerArr) {
    // These indexes allow articles to auto-expire - if it is 0, remove such indexes
    if (config.database.articlesExpire === 0) dropIndexPromises.push(dbOps.feeds.dropIndexes(obj.link, linkTracker.shardId, obj.scheduleName))      
  }

  await Promise.all(dropIndexPromises)

  // Decides what collections get removed from database later on
  for (const item of activeSourcesForTracker) {
    const itemSchedule = vipServers.includes(item.server) ? 'vip' : assignedSchedules.getScheduleName(item.rssName)
    const collectionId = storage.collectionId(item.link, bot.shard && bot.shard.count > 0 ? bot.shard.id : undefined, itemSchedule)
    linkTracker.increment(item.link, itemSchedule)
    if ((!bot.shard || bot.shard.count === 0) && !currentCollections.includes(collectionId)) currentCollections.push(collectionId)
  }

  log.init.info(`${SHARD_ID}Finished initialization`)
  if (!bot.shard || bot.shard.count === 0) {
    if (config.database.uri.startsWith('mongo')) await dbOps.statistics.clear()
    await dbOps.linkTracker.write(linkTracker) // If this is a shard, then it's handled by the sharding manager
    await dbOps.general.cleanDatabase(currentCollections)
  }

  return {
    missingGuilds,
    linkTrackerDocs: linkTracker.toDocs()
  }
}
