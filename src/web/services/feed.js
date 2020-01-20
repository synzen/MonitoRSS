const Schedule = require('../../structs/db/Schedule.js')
const Supporter = require('../../structs/db/Supporter.js')
const FailCounter = require('../../structs/db/FailCounter.js')

/**
 * @param {import('../../structs/db/Feed.js')[]} feeds
 * @returns {Object<string, Schedule>}
 */
async function determineSchedules (feeds) {
  const [ schedules, supporterGuilds ] = await Promise.all([
    Schedule.getAll(),
    Supporter.getValidGuilds()
  ])
  const promises = feeds.map(feed => feed.determineSchedule(schedules, supporterGuilds))
  const dSchedules = await Promise.all(promises)
  const data = {}
  for (let i = 0; i < dSchedules.length; ++i) {
    const feed = feeds[i]
    const assignedSchedule = dSchedules[i]
    data[feed._id] = assignedSchedule
  }
  return data
}

/**
 * @param {import('../../structs/db/Feed.js')[]} feeds
 * @returns {Object<string, FailCounter>}
 */
async function getFailCounters (feeds) {
  const urls = [ ...new Set(feeds.map(feed => feed.url)) ]
  const promises = urls.map(feed => FailCounter.getBy('url', feed.url))
  const counters = await Promise.all(promises)
  const data = {}
  for (const counter of counters) {
    data[counter.url] = counter
  }
  return data
}

module.exports = {
  determineSchedules,
  getFailCounters
}
