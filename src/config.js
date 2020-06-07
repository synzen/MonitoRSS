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

exports.set = (override, skipValidation) => {
  // LOG
  if (!override.log) {
    override.log = {}
  }
  const log = config.log
  const logOverride = override.log
  log.level = process.env.DRSS_LOG_LEVEL || logOverride.level || log.level
  log.destination = process.env.DRSS_LOG_DESTINATION || logOverride.destination || log.destination
  log.linkErrs = process.env.DRSS_LOG_LINKERRS !== undefined
    ? Boolean(process.env.DRSS_LOG_LINKERRS)
    : logOverride.linkErrs !== undefined
      ? logOverride.linkErrs
      : log.linkErrs
  log.unfiltered = process.env.DRSS_LOG_UNFILTERED !== undefined
    ? Boolean(process.env.DRSS_LOG_UNFILTERED)
    : logOverride.unfiltered !== undefined
      ? logOverride.unfiltered
      : log.unfiltered
  log.failedFeeds = process.env.DRSS_LOG_FAILEDFEEDS !== undefined
    ? Boolean(process.env.DRSS_LOG_FAILEDFEEDS)
    : logOverride.failedFeeds !== undefined
      ? logOverride.failedFeeds
      : log.failedFeeds

  // BOT
  if (!override.bot) {
    override.bot = {}
  }
  const bot = config.bot
  const botOverride = override.bot
  bot.token = process.env.DRSS_BOT_TOKEN || botOverride.token || bot.token
  bot.locale = process.env.DRSS_BOT_LOCALE || botOverride.locale || bot.locale
  bot.enableCommands = process.env.DRSS_BOT_ENABLECOMMANDS !== undefined
    ? Boolean(process.env.DRSS_BOT_ENABLECOMMANDS)
    : botOverride.enableCommands !== undefined
      ? botOverride.enableCommands
      : bot.enableCommands
  bot.prefix = process.env.DRSS_BOT_PREFIX || botOverride.prefix || bot.prefix
  bot.status = process.env.DRSS_BOT_STATUS || botOverride.status || bot.status
  bot.activityType = process.env.DRSS_BOT_ACTIVITYTYPE || botOverride.activityType || bot.activityType
  bot.activityName = process.env.DRSS_BOT_ACTIVITYNAME || botOverride.activityName || bot.activityName
  bot.streamActivityURL = process.env.DRSS_BOT_STREAMACTIVITYURL || botOverride.streamActivityURL || bot.streamActivityURL
  bot.ownerIDs = envArray('DRSS_BOT_OWNERIDS') || botOverride.ownerIDs || bot.ownerIDs
  bot.menuColor = process.env.DRSS_BOT_MENUCOLOR !== undefined
    ? Number(process.env.DRSS_BOT_MENUCOLOR)
    : botOverride.menuColor !== undefined
      ? botOverride.menuColor
      : bot.menuColor
  bot.deleteMenus = process.env.DRSS_BOT_DELETEMENUS !== undefined
    ? Boolean(process.env.DRSS_BOT_DELETEMENUS)
    : botOverride.deleteMenus !== undefined
      ? botOverride.deleteMenus
      : bot.deleteMenus
  bot.runSchedulesOnStart = process.env.DRSS_BOT_RUNSCHEDULESONSTART !== undefined
    ? Boolean(process.env.RUNSCHEDULESONSTART)
    : botOverride.runSchedulesOnStart !== undefined
      ? botOverride.runSchedulesOnStart
      : bot.runSchedulesOnStart
  bot.exitOnSocketIssues = process.env.DRSS_BOT_EXITONSOCKETISSUES !== undefined
    ? Boolean(process.env.DRSS_BOT_EXITONSOCKETISSUES)
    : botOverride.exitOnSocketIssues !== undefined
      ? botOverride.exitOnSocketIssues
      : bot.exitOnSocketIssues

  // DATABASE
  if (!override.database) {
    override.database = {}
  }
  const database = config.database
  const databaseOverride = override.database
  config.database.uri = process.env.MONGODB_URI || process.env.DRSS_DATABASE_URI || databaseOverride.uri || database.uri
  config.database.redis = process.env.REDIS_URL || process.env.DRSS_DATABASE_REDIS || databaseOverride.redis || database.redis
  config.database.connection = databaseOverride.connection || database.connection
  config.database.articlesExpire = process.env.DRSS_DATABASE_ARTICLESEXPIRE !== undefined
    ? Number(process.env.DRSS_DATABASE_ARTICLESEXPIRE)
    : databaseOverride.articlesExpire !== undefined
      ? databaseOverride.articlesExpire
      : database.articlesExpire

  // FEEDS
  if (!override.feeds) {
    override.feeds = {}
  }
  const feeds = config.feeds
  const feedsOverride = override.feeds
  feeds.refreshRateMinutes = process.env.DRSS_FEEDS_REFRESHRATEMINUTES !== undefined
    ? Number(process.env.DRSS_FEEDS_REFRESHRATEMINUTES)
    : feedsOverride.refreshRateMinutes !== undefined
      ? feedsOverride.refreshRateMinutes
      : feeds.refreshRateMinutes
  feeds.articleRateLimit = process.env.DRSS_FEEDS_ARTICLERATELIMIT !== undefined
    ? Number(process.env.DRSS_FEEDS_ARTICLERATELIMIT)
    : feedsOverride.articleRateLimit !== undefined
      ? feedsOverride.articleRateLimit
      : feeds.articleRateLimit
  feeds.timezone = process.env.DRSS_FEEDS_TIMEZONE || feedsOverride.timezone || feeds.timezone
  feeds.dateFormat = process.env.DRSS_FEEDS_DATEFORMAT || feedsOverride.dateFormat || feeds.dateFormat
  feeds.dateLanguage = process.env.DRSS_FEEDS_DATELANGUAGE || feedsOverride.dateLanguage || feeds.dateLanguage
  feeds.dateLanguageList = envArray('DRSS_FEEDS_DATELANGUAGELIST') || feedsOverride.dateLanguageList || feeds.dateLanguageList
  feeds.dateFallback = process.env.DRSS_FEEDS_DATEFALLBACK !== undefined
    ? Boolean(process.env.DRSS_FEEDS_DATEFALLBACK)
    : feedsOverride.dateFallback !== undefined
      ? feedsOverride.dateFallback
      : feeds.dateFallback
  feeds.timeFallback = process.env.DRSS_FEEDS_TIMEFALLBACK !== undefined
    ? Boolean(process.env.DRSS_FEEDS_TIMEFALLBACK)
    : feedsOverride.timeFallback !== undefined
      ? feedsOverride.timeFallback
      : feeds.timeFallback
  feeds.max = process.env.DRSS_FEEDS_MAX !== undefined
    ? Number(process.env.DRSS_FEEDS_MAX)
    : feedsOverride.max !== undefined
      ? feedsOverride.max
      : feeds.max
  feeds.hoursUntilFail = process.env.DRSS_FEEDS_HOURSUNTILFAIL !== undefined
    ? Number(process.env.DRSS_FEEDS_HOURSUNTILFAIL)
    : feedsOverride.hoursUntilFail !== undefined
      ? feedsOverride.hoursUntilFail
      : feeds.hoursUntilFail
  feeds.notifyFail = process.env.DRSS_FEEDS_NOTIFYFAIL !== undefined
    ? Boolean(process.env.DRSS_FEEDS_NOTIFYFAIL)
    : feedsOverride.notifyFail !== undefined
      ? feedsOverride.notifyFail
      : feeds.notifyFail
  feeds.sendFirstCycle = process.env.DRSS_FEEDS_SENDFIRSTCYCLE !== undefined
    ? Boolean(process.env.DRSS_FEEDS_SENDFIRSTCYCLE)
    : feedsOverride.sendFirstCycle !== undefined
      ? feedsOverride.sendFirstCycle
      : feeds.sendFirstCycle
  feeds.cycleMaxAge = process.env.DRSS_FEEDS_CYCLEMAXAGE !== undefined
    ? Number(process.env.DRSS_FEEDS_CYCLEMAXAGE)
    : feedsOverride.cycleMaxAge !== undefined
      ? feedsOverride.cycleMaxAge
      : feeds.cycleMaxAge
  feeds.defaultText = process.env.DRSS_FEEDS_DEFAULTTEXT || feedsOverride.defaultText || feeds.defaultText
  feeds.imgPreviews = process.env.DRSS_FEEDS_IMGPREVIEWS !== undefined
    ? Boolean(process.env.DRSS_FEEDS_IMGPREVIEWS)
    : feedsOverride.imgPreviews !== undefined
      ? feedsOverride.imgPreviews
      : feeds.imgPreviews
  feeds.imgLinksExistence = process.env.DRSS_FEEDS_IMGLINKSEXISTENCE !== undefined
    ? Boolean(process.env.DRSS_FEEDS_IMGLINKSEXISTENCE)
    : feedsOverride.imgLinksExistence !== undefined
      ? feedsOverride.imgLinksExistence
      : feeds.imgLinksExistence
  feeds.checkDates = process.env.DRSS_FEEDS_CHECKDATES !== undefined
    ? Boolean(process.env.DRSS_FEEDS_CHECKDATES)
    : feedsOverride.checkDates !== undefined
      ? feedsOverride.checkDates
      : feeds.checkDates
  feeds.formatTables = process.env.DRSS_FEEDS_FORMATTABLES !== undefined
    ? Boolean(process.env.DRSS_FEEDS_FORMATTABLES)
    : feedsOverride.formatTables !== undefined
      ? feedsOverride.formatTables
      : feeds.formatTables
  feeds.directSubscribers = process.env.DRSS_FEEDS_DIRECTSUBSCRIBERS !== undefined
    ? Boolean(process.env.DRSS_FEEDS_DIRECTSUBSCRIBERS)
    : feedsOverride.directSubscribers !== undefined
      ? feedsOverride.directSubscribers
      : feeds.directSubscribers
  feeds.decode = feedsOverride.decode || feeds.decode

  // ADVANCED
  if (!override.advanced) {
    override.advanced = {}
  }
  const advanced = config.advanced
  const advancedOverride = override.advanced
  advanced.shards = process.env.DRSS_ADVANCED_SHARDS !== undefined
    ? Number(process.env.DRSS_ADVANCED_SHARDS)
    : advancedOverride.shards !== undefined
      ? advancedOverride.shards
      : advanced.shards
  advanced.batchSize = process.env.DRSS_ADVANCED_BATCHSIZE !== undefined
    ? Number(process.env.DRSS_ADVANCED_BATCHSIZE)
    : advancedOverride.batchSize !== undefined
      ? advancedOverride.batchSize
      : advanced.batchSize
  advanced.parallelBatches = process.env.DRSS_ADVANCED_PARALLELBATCHES !== undefined
    ? Number(process.env.DRSS_ADVANCED_PARALLELBATCHES)
    : advancedOverride.parallelBatches !== undefined
      ? advancedOverride.parallelBatches
      : advanced.parallelBatches
  advanced.parallelRuns = process.env.DRSS_ADVANCED_PARALLELRUNS !== undefined
    ? Number(process.env.DRSS_ADVANCED_PARALLELRUNS)
    : advancedOverride.parallelRuns !== undefined
      ? advancedOverride.parallelRuns
      : advanced.parallelRuns

  // Web URL
  config.webURL = process.env.DRSS_WEBURL || override.webURL || config.webURL

  // Other private ones
  config.dev = process.env.DRSS_DEV !== undefined
    ? Number(process.env.DRSS_DEV)
    : override.dev !== undefined
      ? override.dev
      : config.dev
  config._vip = process.env.DRSS__VIP !== undefined
    ? Number(process.env.DRSS_ENV)
    : override._vip !== undefined
      ? override._vip
      : config._vip
  config._vipRefreshRateMinutes = process.env.DRSS__vipRefreshRateMinutes !== undefined
    ? Number(process.env.DRSS__vipRefreshRateMinutes)
    : override._vipRefreshRateMinutes !== undefined
      ? override._vipRefreshRateMinutes
      : config._vipRefreshRateMinutes

  if (process.env.NODE_ENV !== 'test') {
    moment.locale(config.feeds.dateLanguage)
    // .validate can throw a TypeError
    if (!skipValidation) {
      schema.validate(config)
    }
  }

  return exports.get()
}

exports.get = () => config
