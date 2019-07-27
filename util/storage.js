/*
*   Used to store data for various aperations across multiple files
*/
const URL = require('url').URL
const dbSettings = require('../config.js').database
const articlesExpire = dbSettings.clean === true && (dbSettings.articlesExpire > 0 || dbSettings.articlesExpire === -1) ? dbSettings.articlesExpire : 14
const guildBackupsExpire = dbSettings.guildBackupsExpire > 0 || dbSettings.guildBackupsExpire === -1 ? dbSettings.guildBackupsExpire : 7
const mongoose = require('mongoose')

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

exports.bot = undefined
exports.redisClient = undefined
exports.prefixes = {} // Guild prefixes
exports.initialized = 0 // Different levels dictate what commands may be used while the bot is booting up. 0 = While all shards not initialized, 1 = While shard is initialized, 2 = While all shards initialized
exports.deletedFeeds = [] // Any deleted rssNames to check during article sending to see if it was deleted during a cycle
exports.allScheduleWords = [] // Holds all words across all schedules
exports.allScheduleRssNames = []
exports.scheduleManager = undefined
exports.blacklistUsers = []
exports.blacklistGuilds = []

exports.schemas = {
  schedule: mongoose.Schema({
    name: {
      type: String,
      unique: true
    },
    refreshRateMinutes: Number
  }),
  assignedSchedule: mongoose.Schema({
    feedID: {
      type: String,
      index: true,
      unique: true
    },
    guildID: String,
    shard: Number,
    link: String,
    schedule: String
  }),
  guildRss: mongoose.Schema({
    id: {
      type: String,
      unique: true
    },
    name: String,
    sendAlertsTo: {
      type: [String],
      default: undefined
    },
    sources: Object,
    dateFormat: String,
    dateLanguage: String,
    timezone: String,
    vip: Object,
    prefix: String,
    version: String
  }),
  guildRssBackup: mongoose.Schema({
    id: {
      type: String,
      unique: true
    },
    name: String,
    sendAlertsTo: {
      type: [String],
      default: undefined
    },
    sources: Object,
    dateFormat: String,
    dateLanguage: String,
    timezone: String,
    version: String,
    date: {
      type: Date,
      default: Date.now
    },
    ...guildBackupsExpire > 0 ? { expiresAt: {
      type: Date,
      default: expireDate('guildBackup'),
      index: { expires: 0 }
    } } : {}
  }),
  failedLink: mongoose.Schema({
    link: String,
    count: Number,
    failed: String
  }),
  linkTracker: mongoose.Schema({
    link: String,
    count: Number,
    shard: Number,
    scheduleName: String
  }),
  feed: mongoose.Schema({
    id: String,
    title: String,
    date: {
      type: Date,
      default: Date.now
    },
    customComparisons: Object,
    ...articlesExpire > 0 ? { expiresAt: {
      type: Date,
      default: expireDate('article'),
      index: { expires: 0 }
    } } : {}
  }),
  vip: mongoose.Schema({
    id: {
      type: String,
      unique: true
    },
    invalid: Boolean,
    name: String,
    fname: String,
    servers: {
      type: [String],
      default: []
    },
    permanent: Boolean,
    pledged: Number,
    totalPledged: Number,
    maxFeeds: Number,
    maxServers: Number,
    allowWebhooks: Boolean,
    allowCookies: Boolean,
    expireAt: {
      type: Date,
      index: { expires: 0 }
    },
    gracedUntil: {
      type: Date,
      index: { expires: 0 }
    },
    override: Boolean
  }),
  blacklist: mongoose.Schema({
    isGuild: Boolean,
    id: {
      type: String,
      unique: true
    },
    name: String,
    date: {
      type: Date,
      default: Date.now
    }
  }),
  statistics: mongoose.Schema({
    guilds: Number,
    feeds: Number,
    cycleTime: Number,
    cycleFails: Number,
    cycleLinks: Number,
    shard: {
      type: Number,
      unique: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }),
  feedback: mongoose.Schema({
    type: String,
    userId: String,
    username: String,
    content: String,
    date: {
      type: Date,
      default: Date.now
    }
  }),
  rating: mongoose.Schema({
    type: String,
    userId: String,
    username: String,
    rating: Number,
    date: {
      type: Date,
      default: Date.now
    }
  })
}
exports.collectionID = (link, shardId, scheduleName = '') => {
  if (!scheduleName || scheduleName === 'default') scheduleName = ''
  let res = (shardId != null ? `${shardId}_` : '') + scheduleName.slice(0, 10) + hash(link).toString() + (new URL(link)).hostname.replace(/\.|\$/g, '')
  const len = mongoose.connection.name ? (res.length + mongoose.connection.name.length + 1) : res.length + 1 // mongoose.connection.name is undefined if config.database.uri is a databaseless folder path
  if (len > 115) res = res.slice(0, 115)
  return res
}
exports.models = {
  Schedule: () => mongoose.model('schedules', exports.schemas.schedule),
  AssignedSchedule: () => mongoose.model('assigned_schedules', exports.schemas.assignedSchedule),
  GuildRss: () => mongoose.model('guilds', exports.schemas.guildRss),
  GuildRssBackup: () => mongoose.model('guild_backups', exports.schemas.guildRssBackup),
  FailedLink: () => mongoose.model('failed_links', exports.schemas.failedLink),
  LinkTracker: () => mongoose.model('link_trackers', exports.schemas.linkTracker),
  Feed: (link, shardId, scheduleName) => mongoose.model(exports.collectionID(link, shardId, scheduleName), exports.schemas.feed, exports.collectionID(link, shardId, scheduleName)), // Third parameter is not let mongoose auto-pluralize the collection name
  FeedByCollectionID: collectionID => mongoose.model(collectionID, exports.schemas.feed, collectionID), // Third parameter is not let mongoose auto-pluralize the collection name
  VIP: () => mongoose.model('vips', exports.schemas.vip),
  Blacklist: () => mongoose.model('blacklists', exports.schemas.blacklist),
  Statistics: () => mongoose.model('statistics', exports.schemas.statistics),
  Feedback: () => mongoose.model('feedbacks', exports.schemas.feedback),
  Rating: () => mongoose.model('ratings', exports.schemas.rating)
}
