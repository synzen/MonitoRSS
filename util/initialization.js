const config = require('../config.js')
const storage = require('./storage.js')
const checkGuild = require('./checkGuild.js')
const LinkTracker = require('../structs/LinkTracker.js')
const dbOpsGuilds = require('./db/guilds.js')
const dbOpsFailedLinks = require('./db/failedLinks.js')
const dbOpsBlacklists = require('./db/blacklists.js')
const dbOpsSchedules = require('./db/schedules.js')
const dbOpsStatistics = require('./db/statistics.js')
const dbOpsGeneral = require('./db/general.js')
const log = require('./logger.js')
const redisIndex = require('../structs/db/Redis/index.js')
const FAIL_LIMIT = config.feeds.failLimit

function reachedFailCount (link, failedLinks) {
  const failed = typeof failedLinks[link] === 'string' || (typeof failedLinks[link] === 'number' && failedLinks[link] >= FAIL_LIMIT) // string indicates it has reached the fail count, and is the date of when it failed
  if (failed && config.log.failedFeeds !== false) log.init.warning(`Feeds with link ${link} will be skipped due to reaching fail limit (${FAIL_LIMIT})`)
  return failed
}

module.exports = async bot => {
  const currentCollections = new Set() // currentCollections is only used if there is no sharding (for database cleaning)
  const linkTracker = new LinkTracker([], bot)
  const SHARD_ID = bot.shard && bot.shard.count > 0 ? 'SH ' + bot.shard.id + ' ' : ''
  const guildsInfo = {}
  const missingGuilds = {}
  const activeSourcesForTracker = []

  // Remove expires index
  if (config.database.guildBackupsExpire <= 0) {
    await dbOpsGuilds.dropBackupIndexes()
  }

  // Cache blacklisted users and guilds
  const docs = await dbOpsBlacklists.getAll()
  for (var d = 0; d < docs.length; ++d) {
    const blisted = docs[d]
    if (blisted.isGuild) storage.blacklistGuilds.push(blisted.id)
    else storage.blacklistUsers.push(blisted.id)
  }
  const failedLinks = {}
  const failedLinksArr = await dbOpsFailedLinks.getAll()
  failedLinksArr.forEach(item => {
    failedLinks[item.link] = item.failed || item.count
  })

  // Remove missing guilds and empty guildRsses, along with other checks
  const guildRssList = await dbOpsGuilds.getAll()
  const updatePromises = []
  const removePromises = []
  for (var r = 0; r < guildRssList.length; ++r) {
    const guildRss = guildRssList[r]
    const guildId = guildRss.id
    if (!bot.guilds.has(guildId)) { // Check if it is a valid guild in bot's guild collection
      if (bot.shard && bot.shard.count > 0) missingGuilds[guildId] = guildRss
      else removePromises.push(dbOpsGuilds.remove(guildRss, true))
      continue
    }
    if (guildRss.prefix) storage.prefixes[guildId] = guildRss.prefix
    if (dbOpsGuilds.empty(guildRss)) continue
    let shouldUpdate = false
    const updatedSubscriptions = await checkGuild.subscriptions(bot, guildRss)
    const updatedVersion = await checkGuild.version(guildRss)
    shouldUpdate = updatedSubscriptions || updatedVersion

    guildsInfo[guildId] = guildRss
    const rssList = guildRss.sources

    for (const rssName in rssList) {
      const source = rssList[rssName]
      // Assign feeds to specific schedules in assignedSchedules for use by feedSchedules by rssNames first
      if (checkGuild.config(bot, guildRss, rssName, true) && !reachedFailCount(source.link, failedLinks)) activeSourcesForTracker.push({ link: source.link, rssName, server: guildId })
    }

    if (shouldUpdate) updatePromises.push(dbOpsGuilds.update(guildRss))
  }

  await Promise.all(updatePromises)
  await Promise.all(removePromises)

  // Redis is only for UI use
  const redisPromises = []
  const restorePromises = []
  const restorePromisesIDRecord = []

  bot.guilds.forEach((guild, guildId) => {
    redisPromises.push(redisIndex.Guild.utils.recognize(guild)) // This will recognize all guild info, members, channels and roles
    if (guildsInfo[guildId]) return // If the guild profile exists, then mark as completed - otherwise check for backups
    restorePromises.push(dbOpsGuilds.restore(guildId))
    restorePromisesIDRecord.push(guildId)
  })

  if (redisIndex.Base.clientExists) {
    bot.users.forEach(user => redisPromises.push(redisIndex.User.utils.recognize(user)))
  }

  await Promise.all(restorePromises)
  await Promise.all(restorePromisesIDRecord)
  await Promise.all(redisPromises)

  const linkTrackerArr = linkTracker.toDocs()
  const dropIndexPromises = []
  for (var obj of linkTrackerArr) {
    // These indexes allow articles to auto-expire - if it is 0, remove such indexes
    if (config.database.articlesExpire === 0 && config.database.uri.startsWith('mongo')) {
      dropIndexPromises.push(storage.models.Feed(obj.link, linkTracker.shardId, obj.scheduleName).collection.dropIndexes())
    }
  }

  await Promise.all(dropIndexPromises)

  // Decides what collections get removed from database later on
  const assignedSchedules = await dbOpsSchedules.assignedSchedules.getAll() // The schedules should be assigned before this initialization function runs
  for (const assigned of assignedSchedules) {
    const { link, schedule } = assigned
    const collectionID = storage.collectionID(link, bot.shard && bot.shard.count > 0 ? bot.shard.id : undefined, schedule)
    if (!bot.shard || bot.shard.count === 0) currentCollections.add(collectionID)
    else linkTracker.increment(link, schedule)
  }

  if (!bot.shard || bot.shard.count === 0) {
    await dbOpsStatistics.clear()
    await dbOpsGeneral.cleanDatabase(currentCollections)
  }

  log.init.info(`${SHARD_ID}Finished initialization`)

  return {
    missingGuilds,
    linkTrackerDocs: linkTracker.toDocs()
  }
}
