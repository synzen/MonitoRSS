const Feed = require('../../structs/db/Feed.js')
const Article = require('../../models/Article.js')
const Schedule = require('../../structs/db/Schedule.js')
const Supporter = require('../../structs/db/Supporter.js')

/**
 * @param {Map<string, number>} guildIdsByShard
 */
async function getCompoundIDs (guildIdsByShard) {
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
    const shard = guildIdsByShard.get(feed.guild)
    const schedule = assignedSchedules[i].name

    if (shard !== undefined) {
      const compoundID = shard + schedule + url
      compoundIDs.add(compoundID)
    }
  }
  return compoundIDs
}

/**
 * Precondition: Schedules have already been created in DB,
 * feeds, and guilds have been pruned
 *
 * Prune article collections that are no longer used
 * @param {Map<string, number>} guildIdsByShard
 */
async function pruneArticles (guildIdsByShard) {
  if (!Feed.isMongoDatabase) {
    return -1
  }
  const compoundIDs = await exports.getCompoundIDs(guildIdsByShard)
  const articles = await Article.model.find({}).exec()
  const removals = []
  for (var i = articles.length - 1; i >= 0; --i) {
    const article = articles[i]
    const url = article.feedURL
    const shard = article.shardID
    const schedule = article.scheduleName

    const compoundID = shard + schedule + url
    if (!compoundIDs.has(compoundID)) {
      removals.push(article.remove())
    }
  }
  await Promise.all(removals)
  return removals.length
}

exports.pruneArticles = pruneArticles
exports.getCompoundIDs = getCompoundIDs
