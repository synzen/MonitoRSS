const storage = require('./storage.js')
const KeyValue = require('../structs/db/KeyValue.js')
const Schedule = require('../structs/db/Schedule.js')
const Supporter = require('../structs/db/Supporter.js')
const Profile = require('../structs/db/Profile.js')
const redisIndex = require('../structs/db/Redis/index.js')
const getConfig = require('../config.js').get

/**
 * Stores the feeds config for use by the control panel
 * that is an external process
 */
async function populateKeyValues () {
  const config = getConfig()
  await KeyValue.deleteAll()
  const data = {
    _id: 'feedConfig',
    value: config.feeds
  }
  const feedsConfig = new KeyValue(data)
  await feedsConfig.save()
}

async function populatePefixes () {
  const profiles = await Profile.getAll()
  for (const profile of profiles) {
    const guildId = profile.id
    if (profile.prefix) {
      storage.prefixes[guildId] = profile.prefix
    }
  }
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
 * Redis is only for UI use
 * @param {import('discord.js').Client} bot
 */
async function populateRedis (bot) {
  if (!redisIndex.Base.clientExists) {
    return
  }
  const promises = []
  bot.guilds.cache.forEach((guild, guildId) => {
    // This will recognize all guild info, members, channels and roles
    promises.push(redisIndex.Guild.utils.recognize(guild))
  })

  bot.users.cache.forEach(user => promises.push(redisIndex.User.utils.recognize(user)))

  await Promise.all(promises)
}

module.exports = {
  populateRedis,
  populateSchedules,
  populatePefixes,
  populateKeyValues
}
