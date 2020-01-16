const config = require('../config.js')
const storage = require('./storage.js')
const Schedule = require('../structs/db/Schedule.js')
const Supporter = require('../structs/db/Supporter.js')
const Profile = require('../structs/db/Profile.js')
const redisIndex = require('../structs/db/Redis/index.js')

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
 * @param {Object<string, string|number>[]} customSchedules
 * @returns {Schedule[]}
 */
async function populateSchedules (customSchedules = []) {
  await Schedule.deleteAll()
  const schedules = []
  const defaultSchedule = new Schedule({
    name: 'default',
    refreshRateMinutes: config.feeds.refreshRateMinutes
  })

  schedules.push(defaultSchedule)

  for (const schedule of customSchedules) {
    const { name, refreshRateMinutes } = schedule
    if (name === 'example') {
      continue
    }
    const custom = new Schedule({
      name,
      refreshRateMinutes
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
  bot.guilds.forEach((guild, guildId) => {
    // This will recognize all guild info, members, channels and roles
    promises.push(redisIndex.Guild.utils.recognize(guild))
  })

  bot.users.forEach(user => promises.push(redisIndex.User.utils.recognize(user)))

  await Promise.all(promises)
}

module.exports = {
  populateRedis,
  populateSchedules,
  populatePefixes
}
