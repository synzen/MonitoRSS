const pruneGuilds = require('./pruneGuilds.js')
const pruneFeeds = require('./pruneFeeds.js')
const pruneFormats = require('./pruneFormats.js')
const pruneFailCounters = require('./pruneFailCounters.js')
const pruneSubscribers = require('./pruneSubscribers.js')
const pruneCollections = require('./pruneCollections.js')
const flushRedis = require('./flushRedis.js')
const checkLimits = require('./checkLimits.js')
const checkPermissions = require('./checkPermissions.js')
const ShardStats = require('../../structs/db/ShardStats.js')
const Supporter = require('../../structs/db/Supporter.js')
const Patron = require('../../structs/db/Patron.js')
const log = require('../logger.js')

/**
 * @param {Map<string, number>} guildIdsByShard
 * @param {import('discord.js').Client} bot
 */
async function prunePreInit (guildIdsByShard, bot) {
  await Promise.all([
    ShardStats.deleteAll(),
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

function cycleFunctions () {
  if (Supporter.enabled) {
    Patron.refresh()
      .then(() => log.general.info(`Patron check finished`))
      .catch(err => log.general.error(`Failed to refresh patrons on timer`, err))
  }
}

async function cycle () {
  cycleFunctions()
  // Every 10 minutes run these functions
  return setInterval(cycleFunctions, 600000)
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
  checkPermissions,
  cycle
}
