const mongoose = require('mongoose')
const config = require('../../config.js')
const AssignedSchedule = require('../../structs/db/AssignedSchedule.js')
const Article = require('../../models/Article.js')

/**
 * Precondition: AssignedSchedules have already been created
 *
 * Prune article collections that are no longer used
 */
async function pruneCollections () {
  if (config.database.clean !== true || !AssignedSchedule.isMongoDatabase) {
    return -1
  }
  // currentCollections is only used if there is no sharding (for database cleaning)
  const assignedSchedules = await AssignedSchedule.getAll()
  const currentCollections = new Set()
  const dropIndexes = []
  for (const assigned of assignedSchedules) {
    const { url, shard, schedule } = assigned
    const collectionID = Article.getCollectionID(url, shard, schedule)
    currentCollections.add(collectionID)

    if (config.database.articlesExpire === 0) {
      // These indexes allow articles to auto-expire - if it is 0, remove such indexes
      dropIndexes.push(Article.model(url, shard, schedule).collection.dropIndexes())
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
