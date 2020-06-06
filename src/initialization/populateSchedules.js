const Supporter = require('../structs/db/Supporter.js')
const Schedule = require('../structs/db/Schedule.js')
const getConfig = require('../config.js').get

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
      refreshRateMinutes: supporterRefreshRate,
      // Determined at runtime
      keywords: []
    })
    schedules.push(supporterSchedule)
  }
  await Promise.all(schedules.map(s => s.save()))
  return schedules
}

module.exports = populateSchedules
