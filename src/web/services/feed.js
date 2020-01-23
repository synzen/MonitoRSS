const Article = require('../../structs/Article.js')
const FeedFetcher = require('../../util/FeedFetcher.js')
const Schedule = require('../../structs/db/Schedule.js')
const Supporter = require('../../structs/db/Supporter.js')
const FailCounter = require('../../structs/db/FailCounter.js')
const Feed = require('../../structs/db/Feed.js')
const config = require('../../config.js')

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
    if (counter) {
      data[counter.url] = counter
    }
  }
  return data
}

/**
 * @param {string} url
 * @param {Object<string, any>} profile
 */
async function getFeedPlaceholders (url, profile = config.feeds) {
  const { articleList } = await FeedFetcher.fetchFeed(url)
  const allPlaceholders = []
  if (articleList.length === 0) {
    return allPlaceholders
  }
  for (const article of articleList) {
    const parsed = new Article(article, profile)
    allPlaceholders.push(parsed.toJSON())
  }
  return allPlaceholders
}

/**
 * @param {string} guildID
 * @param {string} feedID
 * @returns {Feed|null}
 */
async function getFeedOfGuild (guildID, feedID) {
  return Feed.getByQuery({
    _id: feedID,
    guild: guildID
  })
}

/**
 * @param {Object<string, any>} data 
 */
async function createFeed (data) {
  const feed = new Feed(data)
  await feed.testAndSave()
  return feed.toJSON()
}

module.exports = {
  determineSchedules,
  getFailCounters,
  getFeedPlaceholders,
  getFeedOfGuild,
  createFeed
}
