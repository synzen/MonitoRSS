const getFeeds = require('./getFeeds.js')
const createFeed = require('./createFeed.js')
const editFeed = require('./editFeed.js')
const deleteFeed = require('./deleteFeed.js')
const getSchedule = require('./getSchedule.js')
const getFeedPlaceholders = require('./getFeedPlaceholders.js')
const getDatabaseArticles = require('./getDatabaseArticles.js')
const subscribers = require('./subscribers/index.js')

module.exports = {
  getFeeds,
  createFeed,
  editFeed,
  deleteFeed,
  getSchedule,
  getFeedPlaceholders,
  getDatabaseArticles,
  subscribers
}
