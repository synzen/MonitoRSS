const pruneProfiles = require('./pruneProfiles.js')
const pruneProfileAlerts = require('./pruneProfileAlerts.js')
const pruneFeeds = require('./pruneFeeds.js')
const pruneArticles = require('./pruneArticles.js')
const pruneFilteredFormats = require('./pruneFilteredFormats.js')
const pruneFailRecords = require('./pruneFailRecords.js')
const pruneSubscribers = require('./pruneSubscribers.js')
const pruneWebhooks = require('./pruneWebhooks.js')
const flushRedis = require('./flushRedis.js')
const checkLimits = require('./checkLimits.js')
const checkPermissions = require('./checkPermissions.js')
const checkArticleIndexes = require('./checkArticleIndexes.js')
const ScheduleStats = require('../structs/db/ScheduleStats.js')
const Supporter = require('../structs/db/Supporter.js')
const Patron = require('../structs/db/Patron.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')
const log = createLogger()

/**
 * @param {Map<string, number>} guildIdsByShard
 * @param {Map<string, number>} channelIdsByShard
 * @param {import('discord.js').Client} bot
 */
async function prunePreInit (guildIdsByShard, channelIdsByShard) {
  const config = getConfig()
  await Promise.all([
    checkArticleIndexes(config.feeds.articlesExpire),
    ScheduleStats.deleteAll(),
    flushRedis(),
    pruneProfiles(guildIdsByShard)
  ])
  await pruneFeeds(guildIdsByShard, channelIdsByShard)
  await Promise.all([
    pruneFilteredFormats(),
    pruneFailRecords()
  ])
}

/**
 * @param {import('discord.js').Client} bot
 */
async function pruneWithBot (bot) {
  await Promise.all([
    pruneSubscribers(bot),
    pruneProfileAlerts(bot),
    pruneWebhooks(bot),
    checkPermissions.feeds(bot)
  ])
}

/**
 * @param {Map<string, number>} guildIdsByShard
 */
async function prunePostInit (guildIdsByShard) {
  await pruneArticles.pruneArticles(guildIdsByShard)
}

function cycleFunctions () {
  if (Supporter.enabled) {
    Patron.refresh()
      .then(() => log.info(`Patron check finished`))
      .catch(err => log.error(err, `Failed to refresh patrons on timer`))
  }
}

async function cycle () {
  cycleFunctions()
  // Every 10 minutes run these functions
  return setInterval(cycleFunctions, 600000)
}

module.exports = {
  flushRedis,
  pruneWithBot,
  prunePreInit,
  prunePostInit,
  pruneProfiles,
  pruneProfileAlerts,
  pruneFeeds,
  pruneArticles,
  pruneFilteredFormats,
  pruneFailRecords,
  pruneSubscribers,
  checkLimits,
  checkPermissions,
  checkArticleIndexes,
  cycle
}
