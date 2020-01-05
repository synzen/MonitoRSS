const AssignedSchedule = require('../../structs/db/AssignedSchedule.js')
const pruneGuilds = require('./pruneGuilds.js')
const pruneFeeds = require('./pruneFeeds.js')
const pruneFormats = require('./pruneFormats.js')
const pruneFailCounters = require('./pruneFailCounters.js')
const pruneSubscribers = require('./pruneSubscribers.js')
const pruneCollections = require('./pruneCollections.js')
const flushRedis = require('./flushRedis.js')
const checkLimits = require('./checkLimits.js')
const checkPermissions = require('./checkPermissions.js')

/**
 * @param {Map<string, number>} guildIdsByShard
 * @param {import('discord.js').Client} bot
 */
async function prunePreInit (guildIdsByShard, bot) {
  await Promise.all([
    AssignedSchedule.deleteAll(),
    flushRedis(),
    pruneGuilds(guildIdsByShard)
  ])
  await pruneFeeds(guildIdsByShard)
  await Promise.all([
    pruneFormats(),
    pruneFailCounters()
  ])
  if (bot) {
    await pruneSubscribers(bot)
  }
  // Prune collections should not be called here until schedules were assigned
}

/**
 * @param {Map<string, number>} guildIdsByShard
 */
async function prunePostInit (guildIdsByShard) {
  await pruneCollections(guildIdsByShard)
}

module.exports = {
  flushRedis,
  prunePreInit,
  prunePostInit,
  pruneGuilds,
  pruneFeeds,
  pruneFormats,
  pruneFailCounters,
  pruneSubscribers,
  pruneCollections,
  checkLimits,
  checkPermissions
}
