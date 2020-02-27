const fs = require('fs')
const path = require('path')
const configPath = path.join(__dirname, 'config.json')
const config = JSON.parse(fs.readFileSync(configPath))
const overridePath = path.join(__dirname, '..', 'settings', 'config.json')
const fileOverride = fs.existsSync(overridePath) ? JSON.parse(fs.readFileSync(overridePath)) : {}
const Joi = require('@hapi/joi')

const schema = Joi.object({
  dev: Joi.bool().strict(),
  _vip: Joi.bool().strict(),
  log: Joi.object({
    pretty: Joi.bool().strict().required(),
    linkErrs: Joi.bool().strict().required(),
    unfiltered: Joi.bool().strict().required(),
    failedFeeds: Joi.bool().strict().required()
  }).required(),
  bot: Joi.object({
    token: Joi.string().required(),
    locale: Joi.string().required(),
    enableCommands: Joi.bool().strict().required(),
    prefix: Joi.string().required(),
    status: Joi.string().valid('online', 'dnd', 'invisible', 'idle').required(),
    activityType: Joi.string().valid('', 'PLAYING', 'STREAMING', 'LISTENING', 'WATCHING').required(),
    activityName: Joi.string().allow('').required(),
    streamActivityURL: Joi.string().allow('').required(),
    ownerIDs: Joi.array().items(Joi.string()).required(),
    menuColor: Joi.number().strict().greater(0).required(),
    deleteMenus: Joi.bool().strict().required(),
    exitOnSocketIssues: Joi.bool().strict().required(),
    commandAliases: Joi.object().pattern(/^/, Joi.string().required())
  }).required(),
  database: Joi.object({
    uri: Joi.string().required(),
    redis: Joi.string().allow('').required(),
    connection: Joi.object().required(),
    articlesExpire: Joi.number().strict().greater(-1).required()
  }),
  feeds: Joi.object({
    refreshRateMinutes: Joi.number().strict().greater(0).required(),
    timezone: Joi.string().required(),
    dateFormat: Joi.string().required(),
    dateLanguage: Joi.string().required(),
    dateLanguageList: Joi.array().items(Joi.string()).required(),
    dateFallback: Joi.bool().strict().required(),
    timeFallback: Joi.bool().strict().required(),
    max: Joi.number().strict().greater(-1).required(),
    hoursUntilFail: Joi.number().strict().required(),
    notifyFail: Joi.bool().strict().required(),
    sendOldOnFirstCycle: Joi.bool().strict().required(),
    cycleMaxAge: Joi.number().strict().required(),
    defaultText: Joi.string().required(),
    imgPreviews: Joi.bool().strict().required(),
    imgLinksExistence: Joi.bool().strict().required(),
    checkDates: Joi.bool().strict().required(),
    formatTables: Joi.bool().strict().required(),
    toggleRoleMentions: Joi.bool().strict().required(),
    decode: Joi.object().pattern(/^/, Joi.string().uri()).required()
  }).required(),
  advanced: Joi.object({
    shards: Joi.number().greater(0).strict().required(),
    batchSize: Joi.number().greater(0).strict().required(),
    parallelBatches: Joi.number().greater(0).strict().required(),
    parallelShards: Joi.number().greater(0).strict().required()
  }).required(),
  web: Joi.object({
    enabled: Joi.bool().strict().required(),
    trustProxy: Joi.bool().strict().required(),
    sessionSecret: Joi.string().required(),
    port: Joi.number().strict().required(),
    redirectUri: Joi.string().allow('').required(),
    clientId: Joi.string().allow('').required(),
    clientSecret: Joi.string().allow('').required(),
    https: Joi.object({
      enabled: Joi.bool().strict().required(),
      privateKey: Joi.string().allow('').required(),
      certificate: Joi.string().allow('').required(),
      chain: Joi.string().allow('').required(),
      port: Joi.number().strict().required()
    }).required()
  }).required()
})

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
feeds.sendOldOnFirstCycle = Boolean(process.env.DRSS_FEEDS_SENDOLDONFIRSTCYCLE) || feedsOverride.sendOldOnFirstCycle === undefined ? feeds.sendOldOnFirstCycle : feedsOverride.sendOldOnFirstCycle
feeds.cycleMaxAge = Number(process.env.DRSS_FEEDS_CYCLEMAXAGE) || feedsOverride.cycleMaxAge === undefined ? feeds.cycleMaxAge : feedsOverride.cycleMaxAge
feeds.defaultText = process.env.DRSS_FEEDS_DEFAULTTEXT || feedsOverride.defaultText || feeds.defaultText
feeds.imgPreviews = Boolean(process.env.DRSS_FEEDS_IMGPREVIEWS) || feedsOverride.imgPreviews === undefined ? feeds.imgPreviews : feedsOverride.imgPreviews
feeds.imgLinksExistence = Boolean(process.env.DRSS_FEEDS_IMGLINKSEXISTENCE) || feedsOverride.imgLinksExistence === undefined ? feeds.imgLinksExistence : feedsOverride.imgLinksExistence
feeds.checkDates = Boolean(process.env.DRSS_FEEDS_CHECKDATES) || feedsOverride.checkDates === undefined ? feeds.checkDates : feedsOverride.checkDates
feeds.formatTables = Boolean(process.env.DRSS_FEEDS_FORMATTABLES) || feedsOverride.formatTables === undefined ? feeds.formatTables : feedsOverride.formatTables
feeds.toggleRoleMentions = Boolean(process.env.DRSS_FEEDS_TOGGLEROLEMENTIONS) || feedsOverride.toggleRoleMentions === undefined ? feeds.toggleRoleMentions : feedsOverride.toggleRoleMentions

// ADVANCED
if (!fileOverride.advanced) {
  fileOverride.advanced = {}
}
const advanced = config.advanced
const advancedOverride = fileOverride.advanced
advanced.shards = Number(process.env.DRSS_ADVANCED_SHARDS) || advancedOverride.shards || advanced.shards
advanced.batchSize = Number(process.env.DRSS_ADVANCED_BATCHSIZE) || advancedOverride.batchSize || advanced.batchSize
advanced.parallelBatches = Number(process.env.DRSS_ADVANCED_PARALLELBATCHES) || advancedOverride.parallelBatches || advanced.parallelBatches
advanced.parallelShards = Number(process.env.DRSS_ADVANCED_PARALLELSHARDS) || advancedOverride.parallelShards || advanced.parallelShards

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
web.redirectUri = process.env.DRSS_WEB_REDIRECTURI || webOverride.redirectUri || web.redirectUri
web.clientId = process.env.DRSS_WEB_CLIENTID || webOverride.clientId || web.clientId
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
  const results = schema.validate(config, {
    abortEarly: false
  })

  if (results.error) {
    const output = results.error.details
      .map(d => d.message)
      .join('\n')
    throw new TypeError(`Config validation failed\n${output}\n`)
  }
}

module.exports = config
