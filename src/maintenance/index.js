const pruneProfiles = require('./pruneProfiles.js')
const pruneProfileAlerts = require('./pruneProfileAlerts.js')
const pruneFeeds = require('./pruneFeeds.js')
const pruneFilteredFormats = require('./pruneFilteredFormats.js')
const pruneFailRecords = require('./pruneFailRecords.js')
const pruneSubscribers = require('./pruneSubscribers.js')
const pruneWebhooks = require('./pruneWebhooks.js')
const checkLimits = require('./checkLimits.js')
const checkPermissions = require('./checkPermissions.js')
const checkArticleIndexes = require('./checkArticleIndexes.js')
const ScheduleStats = require('../structs/db/ScheduleStats.js')
const Supporter = require('../structs/db/Supporter.js')
const Patron = require('../structs/db/Patron.js')
const Feed = require('../structs/db/Feed.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

/**
 * @param {Map<string, number>} guildIdsByShard
 * @param {Map<string, number>} channelIdsByShard
 * @param {import('discord.js').Client} bot
 */
async function prunePreInit (guildIdsByShard, channelIdsByShard) {
  const config = getConfig()
  const feeds = await Feed.getAll()
  await Promise.all([
    checkArticleIndexes(config.feeds.articlesExpire),
    ScheduleStats.deleteAll(),
    pruneProfiles(guildIdsByShard)
  ])
  await pruneFeeds(feeds, guildIdsByShard, channelIdsByShard)
  await Promise.all([
    pruneFilteredFormats(feeds),
    pruneFailRecords(feeds)
  ])
}

/**
 * @param {import('discord.js').Client} bot
 */
async function pruneWithBot (bot) {
  const log = createLogger(bot.shard.ids[0])
  const guilds = bot.guilds.cache.keyArray()
  log.debug('Pruning with bot. Fetching feeds')
  const feeds = await Feed.getManyByQuery({
    guild: {
      $in: guilds
    }
  })
  log.debug(`Fetched ${feeds.length} feeds for pruning`)
  await Promise.all([
    pruneSubscribers.pruneSubscribers(bot, feeds),
    pruneProfileAlerts(bot),
    pruneWebhooks.pruneWebhooks(bot, feeds),
    checkPermissions.feeds(bot, feeds)
  ])
}

/**
 * @param {Map<string, number>} guildIdsByShard
 */
async function prunePostInit (guildIdsByShard) {
}

function cycleFunctions () {
  const log = createLogger()
  if (Supporter.enabled) {
    Patron.refresh()
      .then(() => log.info('Patron check finished'))
      .catch(err => log.error(err, 'Failed to refresh patrons on timer'))
  }
}

async function cycle () {
  cycleFunctions()
  // Every 10 minutes run these functions
  return setInterval(cycleFunctions, 600000)
}

module.exports = {
  pruneWithBot,
  prunePreInit,
  prunePostInit,
  pruneProfiles,
  pruneProfileAlerts,
  pruneFeeds,
  pruneFilteredFormats,
  pruneFailRecords,
  pruneSubscribers,
  checkLimits,
  checkPermissions,
  checkArticleIndexes,
  cycle
}
