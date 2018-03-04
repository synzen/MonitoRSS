/*
*   Used to store data for various aperations across multiple files
*/
const fs = require('fs')
const dbSettings = require('../config.json').database
const articlesExpire = dbSettings.clean === true && dbSettings.articlesExpire > 0 ? dbSettings.articlesExpire : -1
const guildBackupsExpire = dbSettings.guildBackupsExpire > 0 ? dbSettings.articlesExpire : -1
const mongoose = require('mongoose')
const currentGuilds = new Map()
const linkList = []
const linkTracker = {}
const allScheduleWords = []
let limitOverrides = {}
let webhookServers = [] // Server IDs
let cookieServers = [] // Server IDs
let blacklistUsers = []
let blacklistGuilds = []
let initialized = 0 // Different levels dictate what commands may be used while the bot is booting up. 0 = While all shards not initialized, 1 = While shard is initialized, 2 = While all shards initialized
let deletedFeeds = []
let failedLinks = {}
let scheduleManager

try {
  failedLinks = JSON.parse(fs.readFileSync('./settings/failedLinks.json'))
} catch (e) {
  failedLinks = {}
}

const articleSchema = {
  id: String,
  title: String,
  date: {
    type: Date,
    default: Date.now
  }
}

const guildRssSchema = {
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
}

const guildRssBackupSchema = {
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
  }
}

const vipSchema = {
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
  allowCookies: Boolean
}

const blacklistSchema = {
  isGuild: Boolean,
  id: String,
  name: String,
  date: {
    type: Date,
    default: Date.now
  }
}

if (articlesExpire > 0) articleSchema.date.index = { expires: 60 * 60 * 24 * articlesExpire }
if (guildBackupsExpire > 0) guildRssBackupSchema.date.index = { expires: 60 * 60 * 24 * guildBackupsExpire }

exports.initialized = initialized
exports.linkList = linkList
exports.currentGuilds = currentGuilds // To hold all guild profiles
exports.deletedFeeds = deletedFeeds // Any deleted rssNames to check during sendToDiscord if it was deleted during a cycle
exports.linkTracker = linkTracker // To track schedule assignment to links
exports.allScheduleWords = allScheduleWords // Holds all words across all schedules
exports.failedLinks = failedLinks
exports.scheduleManager = scheduleManager
exports.limitOverrides = limitOverrides
exports.webhookServers = webhookServers
exports.cookieServers = cookieServers
exports.blacklistUsers = blacklistUsers
exports.blacklistGuilds = blacklistGuilds
exports.schemas = {
  guildRss: mongoose.Schema(guildRssSchema),
  guildRssBackup: mongoose.Schema(guildRssBackupSchema),
  article: mongoose.Schema(articleSchema),
  vip: mongoose.Schema(vipSchema),
  blacklist: mongoose.Schema(blacklistSchema)
}
exports.models = {
  GuildRss: () => mongoose.model('Guild', exports.schemas.guildRss),
  GuildRssBackup: () => mongoose.model('Guild_Backup', exports.schemas.guildRssBackup),
  Article: collection => mongoose.model(collection, exports.schemas.article),
  VIP: () => mongoose.model('VIP', exports.schemas.vip),
  Blacklist: () => mongoose.model('Blacklist', exports.schemas.blacklist)
}
