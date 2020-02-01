const createFeed = require('./createFeed.js')
const editFeed = require('./editFeed.js')
const deleteFeed = require('./deleteFeed.js')
const getFeedPlaceholders = require('./getFeedPlaceholders.js')
const getDatabaseArticles = require('./getDatabaseArticles.js')
const subscribers = require('./subscribers/index.js')
const schedules = require('./schedules/index.js')
const failrecords = require('./failrecords/index.js')

module.exports = {
  createFeed,
  editFeed,
  deleteFeed,
  getFeedPlaceholders,
  getDatabaseArticles,
  subscribers,
  schedules,
  failrecords
}
