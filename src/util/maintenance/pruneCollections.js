const mongoose = require('mongoose')
const config = require('../../config.js')
const Feed = require('../../structs/db/Feed.js')
const Article = require('../../models/Article.js')
const Schedule = require('../../structs/db/Schedule.js')
const Supporter = require('../../structs/db/Supporter.js')
/**
 * Precondition: AssignedSchedules have already been created
 *
 * Prune article collections that are no longer used
 * @param {Map<string, number>} guildIdsByShard
 */
async function pruneCollections (guildIdsByShard) {
  if (config.database.clean !== true || !Feed.isMongoDatabase) {
    return -1
  }
  // currentCollections is only used if there is no sharding (for database cleaning)
  const feeds = await Feed.getAll()
  const supporterGuilds = await Supporter.getValidGuilds()
  const schedules = await Schedule.getAll()
  const currentCollections = new Set()
  const dropIndexes = []
  const assignedSchedules = await Promise.all(
    feeds.map(f => f.determineSchedule(schedules, supporterGuilds))
  )
  for (let i = 0; i < feeds.length; ++i) {
    const feed = feeds[i]
    const schedule = assignedSchedules[i]
    const guild = feed.guild
    const shard = guildIdsByShard.get(guild)
    if (shard !== undefined) {
      const collectionID = Article.getCollectionID(feed.url, shard, schedule)
      currentCollections.add(collectionID)
    }
    if (config.database.articlesExpire === 0) {
      // These indexes allow articles to auto-expire - if it is 0, remove such indexes
      dropIndexes.push(Article.model(feed.url, shard, schedule).collection.dropIndexes())
    }
  }
  await Promise.all(dropIndexes)

  // Drop them now
  const collections = await mongoose.connection.db.listCollections().toArray()
  const drops = []
  for (const collection of collections) {
    const name = collection.name
    // Not eligible to be dropped - feed collections all have digits in them
    if (!/\d/.exec(name) || currentCollections.has(name)) {
      continue
    }

    drops.push(mongoose.connection.db.dropCollection(name))
  }
  await Promise.all(drops)
  return drops.length
}

module.exports = pruneCollections
