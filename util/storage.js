/*
*   Used to store data for various aperations across multiple files
*/
const URL = require('url').URL
const dbSettings = require('../config.json').database
const articlesExpire = dbSettings.clean === true && dbSettings.articlesExpire > 0 ? dbSettings.articlesExpire : -1
const guildBackupsExpire = dbSettings.guildBackupsExpire > 0 ? dbSettings.articlesExpire : -1
const mongoose = require('mongoose')
const collectionIds = {}

function hash (str) {
  // https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
  let hash = 0
  if (str.length === 0) return hash
  for (var i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

function expireDate (type) {
  return () => {
    const date = new Date()
    date.setDate(date.getDate() + (type === 'guildBackup' ? guildBackupsExpire : type === 'article' ? articlesExpire : 0)) // Add days
    return date
  }
}
// exports.bot = bot
// exports.scheduleManager = scheduleManager
exports.initialized = 0 // Different levels dictate what commands may be used while the bot is booting up. 0 = While all shards not initialized, 1 = While shard is initialized, 2 = While all shards initialized
exports.statistics = { fullyUpdated: false } // For individual shards/non sharded
exports.statisticsGlobal = { fullyUpdated: 0 } // For aggregated statistics across all shards, updated on an interval by eval
exports.vipServers = {}
exports.currentGuilds = new Map() // To hold all guild profiles
exports.deletedFeeds = [] // Any deleted rssNames to check during sendToDiscord if it was deleted during a cycle
exports.linkTracker = {} // To track schedule assignment to links
exports.allScheduleWords = [] // Holds all words across all schedules
exports.failedLinks = {}
exports.limitOverrides = {}
exports.webhookServers = []
exports.cookieServers = []
exports.blacklistUsers = []
exports.blacklistGuilds = []
exports.schemas = {
  guildRss: mongoose.Schema({
    id: String,
    name: String,
    sources: Object,
    checkTitles: Boolean,
    imgPreviews: Boolean,
    imageLinksExistence: Boolean,
    checkDates: Boolean,
    dateFormat: String,
    dateLanguage: String,
    timezone: String
  }),
  guildRssBackup: mongoose.Schema({
    id: String,
    name: String,
    sources: Object,
    checkTitles: Boolean,
    imgPreviews: Boolean,
    imageLinksExistence: Boolean,
    checkDates: Boolean,
    dateFormat: String,
    dateLanguage: String,
    timezone: String,
    date: {
      type: Date,
      default: Date.now
    },
    ...guildBackupsExpire > 0 ? {expiresAt: {
      type: Date,
      default: expireDate('guildBackup'),
      index: { expires: 0 }
    }} : {}
  }),
  failedLink: mongoose.Schema({
    link: String,
    count: Number,
    failed: String
  }),
  linkTracker: mongoose.Schema({
    link: String,
    count: Number,
    shard: Number
  }),
  feed: mongoose.Schema({
    id: String,
    title: String,
    date: {
      type: Date,
      default: Date.now
    },
    ...articlesExpire > 0 ? {expiresAt: {
      type: Date,
      default: expireDate('article'),
      index: { expires: 0 }
    }} : {}
  }),
  vip: mongoose.Schema({
    id: {
      type: String,
      index: {
        unique: true
      }
    },
    name: String,
    servers: [String],
    maxFeeds: Number,
    allowWebhooks: Boolean,
    allowCookies: Boolean,
    expireAt: {
      type: Date,
      index: { expires: 0 }
    }
  }),
  blacklist: mongoose.Schema({
    isGuild: Boolean,
    id: String,
    name: String,
    date: {
      type: Date,
      default: Date.now
    }
  })
}
exports.collectionId = (link, shardId) => {
  if (collectionIds[link]) return collectionIds[link]
  let res = (shardId != null ? `${shardId}_` : '') + hash(link).toString() + (new URL(link)).hostname.replace(/\.|\$/g, '')
  const len = res.length + mongoose.connection.name.length + 1
  if (len > 115) res = res.slice(0, 115)
  collectionIds[link] = res
  return res
}
exports.models = {
  GuildRss: () => mongoose.model('Guild', exports.schemas.guildRss),
  GuildRssBackup: () => mongoose.model('Guild_Backup', exports.schemas.guildRssBackup),
  FailedLink: () => mongoose.model('Failed_Link', exports.schemas.failedLink),
  LinkTracker: () => mongoose.model('Link_Tracker', exports.schemas.linkTracker),
  Feed: (link, shardId) => mongoose.model(exports.collectionId(link, shardId), exports.schemas.feed),
  VIP: () => mongoose.model('VIP', exports.schemas.vip),
  Blacklist: () => mongoose.model('Blacklist', exports.schemas.blacklist)
}
