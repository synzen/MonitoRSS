const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const KeyValue = require('../structs/db/KeyValue.js')
const Schedule = require('../structs/db/Schedule.js')
const Supporter = require('../structs/db/Supporter.js')
const Command = require('../structs/Command.js')
const ArticleMessageRateLimiter = require('../structs/ArticleMessageRateLimiter.js')
const getConfig = require('../config.js').get

/**
 * @param {string} pascal
 */
function pascalToSnake (pascal) {
  const replaced = pascal.replace(/[A-Z]/g, substr => {
    return `_${substr.toLowerCase()}`
  })
  // Remove the underscore at the beginning of the string
  return replaced.slice(1, replaced.length)
}

/**
 * Sets up all the mongoose models
 *
 * @param {import('mongoose').Connection} connection
 */
async function setupModels (connection) {
  if (!connection) {
    connection = mongoose
  }
  const modelsPath = path.join(__dirname, '..', 'models')
  const contents = await fs.promises.readdir(modelsPath, 'utf-8')
  const files = contents.filter(name => name.endsWith('.js'))
  for (const name of files) {
    const required = require(`../models/${name}`)
    const modelName = pascalToSnake(name).replace('.js', '')
    if (required.setupHooks) {
      required.setupHooks(connection)
    }
    required.Model = connection.model(modelName, required.schema)
  }
}

async function setupCommands () {
  await Profile.populatePrefixes()
  await Command.initialize()
}

/**
 * Stores the feeds config for use by the control panel
 * that is an external process
 */
async function populateKeyValues () {
  const config = getConfig()
  await KeyValue.deleteAll()
  const data = {
    _id: 'feedConfig',
    value: {
      ...config.feeds,
      decode: {}
    }
  }
  const feedsConfig = new KeyValue(data)
  await feedsConfig.save()
}

/**
 * Create schedules for feeds to be assigned to
 * @param {Object<string, Object<string, any>>} customSchedules
 * @returns {Schedule[]}
 */
async function populateSchedules (customSchedules = {}) {
  const config = getConfig()
  await Schedule.deleteAll()
  const schedules = []
  const defaultSchedule = new Schedule({
    name: 'default',
    refreshRateMinutes: config.feeds.refreshRateMinutes
  })

  schedules.push(defaultSchedule)

  for (const name in customSchedules) {
    if (name === 'example') {
      continue
    }
    const schedule = customSchedules[name]
    const { refreshRateMinutes } = schedule
    const custom = new Schedule({
      name,
      refreshRateMinutes,
      keywords: schedule.keywords || [],
      feeds: schedule.feeds || []
    })
    schedules.push(custom)
  }

  if (Supporter.enabled) {
    const supporterRefreshRate = Supporter.schedule.refreshRateMinutes
    if (!supporterRefreshRate || config.feeds.refreshRateMinutes === supporterRefreshRate) {
      throw new Error('Missing valid supporter refresh rate')
    }
    const supporterSchedule = new Schedule({
      name: Supporter.schedule.name,
      refreshRateMinutes: supporterRefreshRate
    })
    schedules.push(supporterSchedule)
  }
  await Promise.all(schedules.map(s => s.save()))
  return schedules
}

/**
 * @param {import('discord.js').Client} bot
 */
async function setupRateLimiters (bot) {
  const guilds = bot.guilds.cache.keyArray()
  const feeds = await Feed.getManyByQuery({
    guild: {
      $in: guilds
    }
  })
  const supporterGuilds = new Set(await Supporter.getValidGuilds())
  for (var i = feeds.length - 1; i >= 0; --i) {
    const feed = feeds[i]
    const channel = bot.channels.cache.get(feed.channel)
    if (!channel) {
      continue
    }
    const isSupporter = supporterGuilds.has(channel.guild.id)
    if (!ArticleMessageRateLimiter.hasLimiter(feed.channel)) {
      ArticleMessageRateLimiter.create(feed.channel, isSupporter)
    }
  }
}

module.exports = {
  setupModels,
  setupCommands,
  populateSchedules,
  populateKeyValues,
  setupRateLimiters
}
