const moment = require('moment-timezone')
const schema = require('./util/config/schema.js')
const config = schema.defaults

function envArray (name) {
  const value = process.env[name]
  if (!value) {
    return null
  }
  return value.split(',').map(s => s.trim())
}

exports.set = (override) => {
  // LOG
  if (!override.log) {
    override.log = {}
  }
  const log = config.log
  const logOverride = override.log
  log.level = process.env.DRSS_LOG_LEVEL || logOverride.level || log.level
  log.destination = process.env.DRSS_LOG_DESTINATION || logOverride.destination || log.destination
  log.linkErrs = Boolean(process.env.DRSS_LOG_LINKERRS) || logOverride.linkErrs === undefined ? log.linkErrs : logOverride.linkErrs
  log.unfiltered = Boolean(process.env.DRSS_LOG_UNFILTERED) || logOverride.unfiltered === undefined ? log.unfiltered : logOverride.unfiltered
  log.failedFeeds = Boolean(process.env.DRSS_LOG_FAILEDFEEDS) || logOverride.failedFeeds === undefined ? log.failedFeeds : logOverride.failedFeeds

  // BOT
  if (!override.bot) {
    override.bot = {}
  }
  const bot = config.bot
  const botOverride = override.bot
  bot.token = process.env.DRSS_BOT_TOKEN || botOverride.token || bot.token
  bot.locale = process.env.DRSS_BOT_LOCALE || botOverride.locale || bot.locale
  bot.enableCommands = Boolean(process.env.DRSS_BOT_ENABLECOMMANDS) || botOverride.enableCommands === undefined ? bot.enableCommands : botOverride.enableCommands
  bot.prefix = process.env.DRSS_BOT_PREFIX || botOverride.prefix || bot.prefix
  bot.status = process.env.DRSS_BOT_STATUS || botOverride.status || bot.status
  bot.activityType = process.env.DRSS_BOT_ACTIVITYTYPE || botOverride.activityType || bot.activityType
  bot.activityName = process.env.DRSS_BOT_ACTIVITYNAME || botOverride.activityName || bot.activityName
  bot.streamActivityURL = process.env.DRSS_BOT_STREAMACTIVITYURL || botOverride.streamActivityURL || bot.streamActivityURL
  bot.ownerIDs = envArray('DRSS_BOT_OWNERIDS') || botOverride.ownerIDs || bot.ownerIDs
  bot.menuColor = Number(process.env.DRSS_BOT_MENUCOLOR) || botOverride.menuColor || bot.menuColor
  bot.deleteMenus = Boolean(process.env.DRSS_BOT_DELETEMENUS) || botOverride.deleteMenus === undefined ? bot.deleteMenus : botOverride.deleteMenus
  bot.runSchedulesOnStart = Boolean(process.env.RUNSCHEDULESONSTART) || botOverride.runSchedulesOnStart === undefined ? bot.runSchedulesOnStart : botOverride.runSchedulesOnStart
  bot.exitOnSocketIssues = Boolean(process.env.DRSS_EXITONSOCKETISSUES) || botOverride.exitOnSocketIssues || bot.exitOnSocketIssues

  // DATABASE
  if (!override.database) {
    override.database = {}
  }
  const database = config.database
  const databaseOverride = override.database
  config.database.uri = process.env.MONGODB_URI || process.env.DRSS_DATABASE_URI || databaseOverride.uri || database.uri
  config.database.redis = process.env.REDIS_URL || process.env.DRSS_DATABASE_REDIS || databaseOverride.redis || database.redis
  config.database.connection = databaseOverride.connection || database.connection
  config.database.articlesExpire = Number(process.env.DRSS_DATABASE_ARTICLESEXPIRE) || databaseOverride.articlesExpire || database.articlesExpire

  // FEEDS
  if (!override.feeds) {
    override.feeds = {}
  }
  const feeds = config.feeds
  const feedsOverride = override.feeds
  feeds.refreshRateMinutes = Number(process.env.DRSS_FEEDS_REFRESHRATEMINUTES) || feedsOverride.refreshRateMinutes || feeds.refreshRateMinutes
  feeds.articleRateLimit = Number(process.env.DRSS_FEEDS_ARTICLERATELIMIT) || feedsOverride.articleRateLimit || feeds.articleRateLimit
  feeds.timezone = process.env.DRSS_FEEDS_TIMEZONE || feedsOverride.timezone || feeds.timezone
  feeds.dateFormat = process.env.DRSS_FEEDS_DATEFORMAT || feedsOverride.dateFormat || feeds.dateFormat
  feeds.dateLanguage = process.env.DRSS_FEEDS_DATELANGUAGE || feedsOverride.dateLanguage || feeds.dateLanguage
  feeds.dateLanguageList = envArray('DRSS_FEEDS_DATELANGUAGELIST') || feedsOverride.dateLanguageList || feeds.dateLanguageList
  feeds.dateFallback = Boolean(process.env.DRSS_FEEDS_DATEFALLBACK) || feedsOverride.dateFallback === undefined ? feeds.dateFallback : feedsOverride.dateFallback
  feeds.timeFallback = Boolean(process.env.DRSS_FEEDS_TIMEFALLBACK) || feedsOverride.timeFallback === undefined ? feeds.timeFallback : feedsOverride.timeFallback
  feeds.max = Number(process.env.DRSS_FEEDS_MAX) || feedsOverride.max === undefined ? feeds.max : feedsOverride.max
  feeds.hoursUntilFail = Number(process.env.DRSS_FEEDS_HOURSUNTILFAIL) || feedsOverride.hoursUntilFail === undefined ? feeds.hoursUntilFail : feedsOverride.hoursUntilFail
  feeds.notifyFail = Boolean(process.env.DRSS_FEEDS_NOTIFYFAIL) || feedsOverride.notifyFail === undefined ? feeds.notifyFail : feedsOverride.notifyFail
  feeds.sendFirstCycle = Boolean(process.env.DRSS_FEEDS_SENDFIRSTCYCLE) || feedsOverride.sendFirstCycle === undefined ? feeds.sendFirstCycle : feedsOverride.sendFirstCycle
  feeds.cycleMaxAge = Number(process.env.DRSS_FEEDS_CYCLEMAXAGE) || feedsOverride.cycleMaxAge === undefined ? feeds.cycleMaxAge : feedsOverride.cycleMaxAge
  feeds.defaultText = process.env.DRSS_FEEDS_DEFAULTTEXT || feedsOverride.defaultText || feeds.defaultText
  feeds.imgPreviews = Boolean(process.env.DRSS_FEEDS_IMGPREVIEWS) || feedsOverride.imgPreviews === undefined ? feeds.imgPreviews : feedsOverride.imgPreviews
  feeds.imgLinksExistence = Boolean(process.env.DRSS_FEEDS_IMGLINKSEXISTENCE) || feedsOverride.imgLinksExistence === undefined ? feeds.imgLinksExistence : feedsOverride.imgLinksExistence
  feeds.checkDates = Boolean(process.env.DRSS_FEEDS_CHECKDATES) || feedsOverride.checkDates === undefined ? feeds.checkDates : feedsOverride.checkDates
  feeds.formatTables = Boolean(process.env.DRSS_FEEDS_FORMATTABLES) || feedsOverride.formatTables === undefined ? feeds.formatTables : feedsOverride.formatTables
  feeds.directSubscribers = Boolean(process.env.DRSS_FEEDS_DIRECTSUBSCRIBERS) || feedsOverride.directSubscribers === undefined ? feeds.directSubscribers : feedsOverride.directSubscribers
  feeds.decode = feedsOverride.decode || feeds.decode

  // ADVANCED
  if (!override.advanced) {
    override.advanced = {}
  }
  const advanced = config.advanced
  const advancedOverride = override.advanced
  advanced.shards = Number(process.env.DRSS_ADVANCED_SHARDS) || advancedOverride.shards || advanced.shards
  advanced.batchSize = Number(process.env.DRSS_ADVANCED_BATCHSIZE) || advancedOverride.batchSize || advanced.batchSize
  advanced.parallelBatches = Number(process.env.DRSS_ADVANCED_PARALLELBATCHES) || advancedOverride.parallelBatches || advanced.parallelBatches
  advanced.parallelRuns = Number(process.env.DRSS_ADVANCED_PARALLELRUNS) || advancedOverride.parallelRuns || advanced.parallelRuns

  // Web URL
  config.webURL = process.env.DRSS_WEBURL || override.webURL || config.webURL

  // Other private ones
  config.dev = process.env.DRSS_DEV || override.dev || config.dev
  config._vip = process.env.DRSS__VIP || override._vip || config._vip
  config._vipRefreshRateMinutes = process.env.DRSS__vipRefreshRateMinutes || override._vipRefreshRateMinutes || config._vipRefreshRateMinutes

  if (process.env.NODE_ENV !== 'test') {
    moment.locale(config.feeds.dateLanguage)
    // .validate can throw a TypeError
    schema.validate(config)
  }

  return exports.get()
}

exports.get = () => config
