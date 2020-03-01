const Feed = require('../structs/db/Feed.js')
const Article = require('../models/Article.js')
const Schedule = require('../structs/db/Schedule.js')
const Supporter = require('../structs/db/Supporter.js')
const createLogger = require('../util/logger/create.js')

async function getCompoundIDs () {
  const feeds = await Feed.getAll()
  const supporterGuilds = await Supporter.getValidGuilds()
  const schedules = await Schedule.getAll()
  const assignedSchedules = await Promise.all(
    feeds.map(f => f.determineSchedule(schedules, supporterGuilds))
  )
  const compoundIDs = new Set()
  for (let i = 0; i < feeds.length; ++i) {
    const feed = feeds[i]
    const url = feed.url
    const schedule = assignedSchedules[i].name

    const compoundID = schedule + url
    compoundIDs.add(compoundID)
  }
  return compoundIDs
}

/**
 * Precondition: Schedules have already been created in DB,
 * feeds, and guilds have been pruned
 *
 * Prune articles that are no longer used
 */
async function pruneArticles () {
  if (!Feed.isMongoDatabase) {
    return -1
  }
  const log = createLogger('M')
  const compoundIDs = await exports.getCompoundIDs()
  const articles = await Article.model.find({}).exec()
  const removals = []
  for (var i = articles.length - 1; i >= 0; --i) {
    const article = articles[i]
    const url = article.feedURL
    const schedule = article.scheduleName

    const compoundID = schedule + url
    if (!compoundIDs.has(compoundID)) {
      removals.push(article.remove())
    }
  }
  await Promise.all(removals)
  const count = removals.length
  if (count > 0) {
    log.info(`Pruned ${count} articles`)
  }
  return count
}

exports.pruneArticles = pruneArticles
exports.getCompoundIDs = getCompoundIDs
