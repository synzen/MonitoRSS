const AssignedSchedule = require('../../structs/db/AssignedSchedule.js')
const pruneGuilds = require('./pruneGuilds.js')
const pruneFeeds = require('./pruneFeeds.js')
const pruneFormats = require('./pruneFormats.js')
const pruneFailCounters = require('./pruneFailCounters.js')
const pruneSubscribers = require('./pruneSubscribers.js')
const pruneCollections = require('./pruneCollections.js')
const flushRedis = require('./flushRedis.js')

/**
 * @param {Set<string>} guildIds
 * @param {import('discord.js').Client} bot
 */
async function prunePreInit (guildIds, bot) {
  await Promise.all([
    AssignedSchedule.deleteAll(),
    flushRedis(),
    pruneGuilds(guildIds)
  ])
  await pruneFeeds(guildIds)
  await Promise.all([
    pruneFormats(),
    pruneFailCounters()
  ])
  if (bot) {
    await pruneSubscribers(bot)
  }
  // Prune collections should not be called here until schedules were assigned
}

async function prunePostInit () {
  await pruneCollections()
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
  pruneCollections
}
