const fs = require('fs')
const path = require('path')
const moment = require('moment-timezone')
const configPath = path.join(__dirname, 'config.json')
const config = JSON.parse(fs.readFileSync(configPath))
const overridePath = path.join(__dirname, '..', 'settings', 'config.json')
const fileOverride = fs.existsSync(overridePath) ? JSON.parse(fs.readFileSync(overridePath)) : {}
const schema = require('./util/config/schema.js')

function envArray (name) {
  const value = process.env[name]
  if (!value) {
    return null
  }
  return value.split(',').map(s => s.trim())
}

// LOG
if (!fileOverride.log) {
  fileOverride.log = {}
}
const log = config.log
const logOverride = fileOverride.log
log.pretty = Boolean(process.env.DRSS_LOG_PRETTY) || logOverride.pretty || log.pretty
log.linkErrs = Boolean(process.env.DRSS_LOG_LINKERRS) || logOverride.linkErrs || log.linkErrs
log.unfiltered = Boolean(process.env.DRSS_LOG_UNFILTERED) || logOverride.unfiltered || log.unfiltered
log.failedFeeds = Boolean(process.env.DRSS_LOG_FAILEDFEEDS) || logOverride.failedFeeds || log.failedFeeds

// BOT
if (!fileOverride.bot) {
  fileOverride.bot = {}
}
const bot = config.bot
const botOverride = fileOverride.bot
bot.token = process.env.DRSS_BOT_TOKEN || botOverride.token || bot.token
bot.locale = process.env.DRSS_BOT_LOCALE || botOverride.locale || bot.locale
bot.enableCommands = Boolean(process.env.DRSS_BOT_ENABLECOMMANDS) || botOverride.enableCommands || bot.enableCommands
bot.prefix = process.env.DRSS_BOT_PREFIX || botOverride.prefix || bot.prefix
bot.status = process.env.DRSS_BOT_STATUS || botOverride.status || bot.status
bot.activityType = process.env.DRSS_BOT_ACTIVITYTYPE || botOverride.activityType || bot.activityType
bot.activityName = process.env.DRSS_BOT_ACTIVITYNAME || botOverride.activityName || bot.activityName
bot.streamActivityURL = process.env.DRSS_BOT_STREAMACTIVITYURL || botOverride.streamActivityURL || bot.streamActivityURL
bot.ownerIDs = envArray('DRSS_BOT_OWNERIDS') || botOverride.ownerIDs || bot.ownerIDs
bot.menuColor = Number(process.env.DRSS_BOT_MENUCOLOR) || botOverride.menuColor || bot.menuColor
bot.deleteMenus = Boolean(process.env.DRSS_BOT_DELETEMENUS) || botOverride.deleteMenus || bot.deleteMenus
bot.exitOnSocketIssues = Boolean(process.env.DRSS_EXITONSOCKETISSUES) || botOverride.exitOnSocketIssues || bot.exitOnSocketIssues
bot.commandAliases = botOverride.commandAliases || bot.commandAliases

// DATABASE
if (!fileOverride.database) {
  fileOverride.database = {}
}
config.database.uri = process.env.MONGODB_URI || process.env.DRSS_DATABASE_URI || fileOverride.database.uri || config.database.uri
config.database.redis = process.env.REDIS_URL || process.env.DRSS_DATABASE_REDIS || fileOverride.database.redis || config.database.redis
config.database.articlesExpire = Number(process.env.DRSS_DATABASE_ARTICLESEXPIRE) || fileOverride.database.articlesExpire || config.database.articlesExpire

// FEEDS
if (!fileOverride.feeds) {
  fileOverride.feeds = {}
}
const feeds = config.feeds
const feedsOverride = fileOverride.feeds
feeds.refreshRateMinutes = Number(process.env.DRSS_FEEDS_REFRESHRATEMINUTES) || feedsOverride.refreshRateMinutes || feeds.refreshRateMinutes
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
feeds.decode = feedsOverride.decode || feeds.decode

// ADVANCED
if (!fileOverride.advanced) {
  fileOverride.advanced = {}
}
const advanced = config.advanced
const advancedOverride = fileOverride.advanced
advanced.shards = Number(process.env.DRSS_ADVANCED_SHARDS) || advancedOverride.shards || advanced.shards
advanced.batchSize = Number(process.env.DRSS_ADVANCED_BATCHSIZE) || advancedOverride.batchSize || advanced.batchSize
advanced.parallelBatches = Number(process.env.DRSS_ADVANCED_PARALLELBATCHES) || advancedOverride.parallelBatches || advanced.parallelBatches

// WEB
if (!fileOverride.web) {
  fileOverride.web = {}
}
const web = config.web
const webOverride = fileOverride.web
web.enabled = Boolean(process.env.DRSS_WEB_ENABLED) || webOverride.enabled === undefined ? web.enabled : webOverride.enabled
web.trustProxy = Boolean(process.env.DRSS_WEB_TRUSTPROXY) || webOverride.trustProxy === undefined ? web.trustProxy : webOverride.trustProxy
web.sessionSecret = process.env.DRSS_WEB_SESSIONSECRET || webOverride.sessionSecret || web.sessionSecret
web.port = Number(process.env.PORT) || Number(process.env.DRSS_WEB_PORT) || webOverride.port || web.port
web.redirectURI = process.env.DRSS_WEB_REDIRECTURI || webOverride.redirectURI || web.redirectURI
web.clientID = process.env.DRSS_WEB_CLIENTID || webOverride.clientID || web.clientID
web.clientSecret = process.env.DRSS_WEB_CLIENTSECRET || webOverride.clientSecret || web.clientSecret

// WEB HTTPS
if (!fileOverride.web.https) {
  fileOverride.web.https = {}
}
const https = config.web.https
const httpsOverride = fileOverride.web.https
https.enabled = Boolean(process.env.DRSS_WEB_HTTPS_ENABLED) || httpsOverride.enabled === undefined ? https.enabled : httpsOverride.enabled
https.privateKey = process.env.DRSS_WEB_HTTPS_PRIVATEKEY || httpsOverride.privateKey || https.privateKey
https.certificate = process.env.DRSS_WEB_HTTPS_CERTIFICATE || httpsOverride.certificate || https.certificate
https.chain = process.env.DRSS_WEB_HTTPS_CHAIN || httpsOverride.chain || https.chain
https.port = Number(process.env.DRSS_WEB_HTTPS_PORT) || httpsOverride.port || https.port

if (!process.env.TEST_ENV) {
  moment.locale(config.feeds.dateLanguage)
  // .validate can throw a TypeError
  schema.validate(config)
}

module.exports = config
