const config = require('../config.js')
const storage = require('./storage.js')
// const checkGuild = require('./checkGuild.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Feed = require('../structs/db/Feed.js')
const dbOpsStatistics = require('./db/statistics.js')
const dbOpsGeneral = require('./db/general.js')
const Article = require('../models/Article.js')
const log = require('./logger.js')
const redisIndex = require('../structs/db/Redis/index.js')
const AssignedSchedule = require('../structs/db/AssignedSchedule.js')

module.exports = async bot => {
  const currentCollections = new Set() // currentCollections is only used if there is no sharding (for database cleaning)
  const shardIDNumber = bot.shard && bot.shard.count > 0 ? bot.shard.id : -1
  const SHARD_ID = bot.shard && bot.shard.count > 0 ? 'SH ' + bot.shard.id + ' ' : ''
  const danglingGuilds = []
  const danglingFeeds = []

  // Remove missing guilds and empty guildRsses, along with other checks
  // const guildRssList = await dbOpsGuilds.getAll()
  const profiles = await GuildProfile.getAll()
  const updatePromises = []
  const removePromises = []
  for (const profile of profiles) {
    const guildId = profile.id
    if (!bot.guilds.has(guildId)) { // Check if it is a valid guild in bot's guild collection
      if (bot.shard && bot.shard.count > 0) {
        danglingGuilds.push(guildId)
      } else {
        removePromises.push(profile.delete())
      }
      continue
    }
    if (profile.prefix) {
      storage.prefixes[guildId] = profile.prefix
    }
  }

  const feeds = await Feed.getAll()
  for (const feed of feeds) {
    const guild = feed.guild
    if (!bot.guilds.has(guild)) {
      if (bot.shard && bot.shard.count > 0) {
        danglingFeeds.push(feed._id)
      } else {
        removePromises.push(feed.delete())
      }
      continue
    }
  }

  await Promise.all(updatePromises)
  await Promise.all(removePromises)

  // Redis is only for UI use
  const redisPromises = []

  bot.guilds.forEach((guild, guildId) => {
    redisPromises.push(redisIndex.Guild.utils.recognize(guild)) // This will recognize all guild info, members, channels and roles
  })

  if (redisIndex.Base.clientExists) {
    bot.users.forEach(user => redisPromises.push(redisIndex.User.utils.recognize(user)))
  }

  await Promise.all(redisPromises)

  const dropIndexPromises = []

  // Decides what collections get removed from database later on
  const assignedSchedules = await AssignedSchedule.getAll() // The schedules should be assigned before this initialization function runs
  const activeLinks = []
  for (const assigned of assignedSchedules) {
    const { url, schedule } = assigned
    const collectionID = Article.getCollectionID(url, shardIDNumber, schedule)
    if (!bot.shard || bot.shard.count === 0) {
      currentCollections.add(collectionID)
    } else {
      if (config.database.articlesExpire === 0 && config.database.uri.startsWith('mongo')) {
        // These indexes allow articles to auto-expire - if it is 0, remove such indexes
        dropIndexPromises.push(Article.model(url, shardIDNumber, schedule).collection.dropIndexes())
      }
      activeLinks.push({ url, scheduleName: schedule, shard: shardIDNumber })
    }
  }

  await Promise.all(dropIndexPromises)

  if (!bot.shard || bot.shard.count === 0) {
    await dbOpsStatistics.clear()
    await dbOpsGeneral.cleanDatabase(currentCollections)
  }

  log.init.info(`${SHARD_ID}Finished initialization`)

  return {
    danglingGuilds,
    danglingFeeds,
    activeLinks
  }
}
