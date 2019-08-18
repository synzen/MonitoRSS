const fs = require('fs')
const path = require('path')
const config = require('./config.json')
const checkConfig = require('./util/checkConfig.js')

function overrideConfigs (configOverrides) {
  if (configOverrides._vip === true) {
    config._vip = true
    config._vipRefreshRateMinutes = configOverrides._vipRefreshRateMinutes
  }
  // Config overrides must be manually done for it to be changed in the original object (config)
  for (var category in config) {
    const configCategory = config[category]
    if (!configOverrides[category]) continue
    for (var configName in configCategory) {
      if (configOverrides[category][configName] !== undefined && configOverrides[category][configName] !== config[category][configName]) {
        configCategory[configName] = configOverrides[category][configName]
      }
    }
  }
}

// Environment variable in Docker container and Heroku if available
config.bot.token = !process.env.DRSS_BOT_TOKEN || process.env.DRSS_BOT_TOKEN === 'drss_docker_token' ? (config.bot.token || 's') : process.env.DRSS_BOT_TOKEN

// process.env.MONGODB_URI is intended for use by Heroku
config.database.uri = process.env.DRSS_DATABASE_URI || process.env.MONGODB_URI || config.database.uri

// Heroku deployment configuration
config.bot.prefix = process.env.DRSS_BOT_PREFIX || config.bot.prefix
config.bot.ownerIDs = process.env.DRSS_BOT_OWNER_IDS ? process.env.DRSS_BOT_OWNER_IDS.split(/\s*,\s*/) : config.bot.ownerIDs
config.feeds.refreshTimeMinutes = Number(process.env.DRSS_FEEDS_REFRESH_TIME_MINUTES) || config.feeds.refreshTimeMinutes
config.feeds.defaultMessage = process.env.DRSS_FEEDS_DEFAULT_MESSAGE ? process.env.DRSS_FEEDS_DEFAULT_MESSAGE.replace(/\\n/g, '\n') : config.feeds.defaultMessage
config.bot.status = process.env.DRSS_BOT_STATUS || config.bot.status
config.bot.activityType = process.env.DRSS_BOT_ACTIVITY_TYPE || config.bot.activityType
config.bot.activityName = process.env.DRSS_BOT_ACTIVITY_NAME || config.bot.activityName
config.bot.streamActivityURL = process.env.DRSS_BOT_STREAM_URL || config.bot.streamActivityURL

// Optional env vars for Heroku deployments
config.bot.locale = process.env.DRSS_BOT_LOCALE || config.bot.locale
config.database.articlesExpire = process.env.DRSS_DATABASE_ARTICLESEXPIRE || config.database.articlesExpire
config.database.guildBackupsExpire = process.env.DRSS_DATABASE_GUILDBACKUPSEXPIRE || config.database.guildBackupsExpire
config.feeds.timezone = process.env.DRSS_FEEDS_TIMEZONE || config.feeds.timezone
config.feeds.imgPreviews = process.env.DRSS_FEEDS_IMGPREVIEWS || config.feeds.imgPreviews
config.feeds.imgLinksExistence = process.env.DRSS_FEEDS_IMGLINKSEXISTENCE || config.feeds.imgLinksExistence
config.feeds.checkDates = process.env.DRSS_FEEDS_CHECKDATES || config.feeds.checkDates
config.feeds.formatTables = process.env.DRSS_FEEDS_TABLEFORMAT || config.feeds.formatTables
config.feeds.toggleRoleMentions = process.env.DRSS_FEEDS_TOGGLEROLEMENTIONS || config.feeds.toggleRoleMentions
config.feeds.dateFormat = process.env.DRSS_FEEDS_DATEFORMAT || config.feeds.dateFormat
config.feeds.dateFallback = process.env.DRSS_FEEDS_DATEFALLBACK || config.feeds.dateFallback
config.feeds.timeFallback = process.env.DRSS_FEEDS_TIMEFALLBACK || config.feeds.timeFallback
config.feeds.notifyFail = process.env.DRSS_FEEDS_NOTIFYFAIL || config.feeds.notifyFail
config.feeds.sendOldOnFirstCycle = process.env.DRSS_FEEDS_SENDOLDFIRSTCYCLE || config.feeds.sendOldOnFirstCycle
config.feeds.cycleMaxAge = process.env.DRSS_FEEDS_CYCLEMAXAGE || config.feeds.cycleMaxAge

// Web
config.web.enabled = process.env.DRSS_WEB_ENABLED === 'true' || config.web.enabled

// process.env.REDIS_URL is intended for use by Heroku
config.database.redis = process.env.DRSS_REDIS_URI || process.env.REDIS_URL || config.database.redis

// process.env.PORT is intended for use by Heroku
config.web.port = process.env.DRSS_WEB_PORT || process.env.PORT || config.web.port
config.web.redirectUri = process.env.DRSS_WEB_REDIRECT_URI || config.web.redirectUri
config.web.clientId = process.env.DRSS_WEB_CLIENT_ID || config.web.clientId
config.web.clientSecret = process.env.DRSS_WEB_CLIENT_SECRET || config.web.clientSecret

const overrideFilePath = path.join(__dirname, '..', 'settings', 'configOverride.json')

if (fs.existsSync(overrideFilePath)) {
  overrideConfigs(JSON.parse(fs.readFileSync(overrideFilePath)))
}

const results = checkConfig.check(config)
if (results && results.fatal) throw new Error(results.message)

module.exports = config
