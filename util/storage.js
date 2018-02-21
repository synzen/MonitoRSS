/*
    Used to store data for various aperations across multiple files
*/
const dbSettings = require('../config.json').database
const articlesExpire = dbSettings.clean === true && dbSettings.articlesExpire > 0 ? dbSettings.articlesExpire : -1
const guildBackupsExpire = dbSettings.guildBackupsExpire > 0 ? dbSettings.articlesExpire : -1
const fs = require('fs')
const mongoose = require('mongoose')
const currentGuilds = new Map()
const linkList = []
const linkTracker = {}
const allScheduleWords = []
let initializing = true
let deletedFeeds = []
let cookieAccessors = {ids: []} // User IDs
let webhookAccessors = {ids: []} // Guild IDs
let overriddenGuilds = {}
let blacklistGuilds = {ids: []}
let failedLinks = {}
let scheduleManager

try {
  cookieAccessors = JSON.parse(fs.readFileSync('./settings/cookieAccessors.json'))
} catch (e) {
  cookieAccessors = {ids: []}
}

try {
  webhookAccessors = JSON.parse(fs.readFileSync('./settings/webhookAccessors.json'))
} catch (e) {
  webhookAccessors = {ids: []}
}

try {
  overriddenGuilds = JSON.parse(fs.readFileSync('./settings/limitOverrides.json'))
} catch (e) {
  overriddenGuilds = {}
}

try {
  blacklistGuilds = JSON.parse(fs.readFileSync('./settings/blacklist.json'))
} catch (e) {
  blacklistGuilds = {ids: []}
}

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

if (articlesExpire > 0) articleSchema.date.index = { expires: 60 * 60 * 24 * articlesExpire }
if (guildBackupsExpire > 0) guildRssBackupSchema.date.index = { expires: 60 * 60 * 24 * guildBackupsExpire }

exports.initializing = initializing
exports.linkList = linkList
exports.blacklistGuilds = blacklistGuilds
exports.currentGuilds = currentGuilds // To hold all guild profiles
exports.deletedFeeds = deletedFeeds // Any deleted rssNames to check during sendToDiscord if it was deleted during a cycle
exports.cookieAccessors = cookieAccessors // If restrictCookies is true in config, this is the list of permitted user IDs
exports.webhookAccessors = webhookAccessors
exports.overriddenGuilds = overriddenGuilds // To track guilds with overridden limits
exports.linkTracker = linkTracker // To track schedule assignment to links
exports.allScheduleWords = allScheduleWords // Holds all words across all schedules
exports.failedLinks = failedLinks
exports.scheduleManager = scheduleManager
exports.schemas = {
  guildRss: mongoose.Schema(guildRssSchema),
  guildRssBackup: mongoose.Schema(guildRssBackupSchema),
  article: mongoose.Schema(articleSchema)
}
exports.models = {
  GuildRss: () => mongoose.model('Guild', exports.schemas.guildRss),
  GuildRssBackup: () => mongoose.model('Guild_Backup', exports.schemas.guildRssBackup),
  Article: collection => mongoose.model(collection, exports.schemas.article)
}
