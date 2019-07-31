const mongoose = require('mongoose')
const config = require('../../config.js')
const Feedback = require('../../models/Feedback.js')
const Rating = require('../../models/Rating.js')
const log = require('../logger.js')
const dbOpsGuilds = require('./guilds.js')

exports.addFeedback = async (user, content, type = 'general') => {
  return Feedback.model().create({
    type,
    userId: user.id,
    username: user.username,
    content: content
  })
}

exports.addRating = async (user, rating, type = 'general') => {
  return Rating.model().create({
    type,
    userId: user.id,
    username: user.username,
    rating
  })
}

exports.cleanDatabase = async currentCollections => { // Remove unused feed collections
  if (!config.database.uri.startsWith('mongo')) return
  if (!(currentCollections instanceof Set)) throw new Error('currentCollections is not a Set')
  const names = await mongoose.connection.db.listCollections().toArray()
  let c = 0
  let d = 0
  names.forEach(elem => {
    const name = elem.name
    if (!/\d/.exec(name) || currentCollections.has(name)) return // Not eligible to be dropped - feed collections all have digits in them
    ++c
    if (config.database.clean !== true) return
    mongoose.connection.db.dropCollection(name).then(() => {
      log.general.info(`Dropped unused feed collection ${name}`)
      if (++d === c) log.general.info('All unused feed collections successfully dropped')
    }).catch(err => {
      log.general.error(`Unable to drop unused collection ${name}`, err)
      if (++d === c) log.general.info('All unused feed collections successfully dropped')
    })
  })
  if (c > 0) log.general.info(config.database.clean === true ? `Number of collections expected to be removed for database cleaning: ${c}` : `Number of unused collections skipping removal due to config.database.clean disabled: ${c}`)
}

exports.verifyFeedIDs = async () => {
  const guilds = await dbOpsGuilds.getAll()
  const feedIDs = new Set()
  const updatePromises = []
  for (const guildRss of guilds) {
    let shouldUpdate = false
    const feedList = guildRss.sources
    if (!feedList) continue
    for (const feedID in feedList) {
      let id = feedID
      while (feedIDs.has(id)) {
        id += Math.floor((Math.random() * 9) + 1)
      }
      if (id !== feedID) {
        Object.defineProperty(feedList, id, Object.getOwnPropertyDescriptor(feedList, feedID))
        delete feedList[feedID]
      }
      feedIDs.add(id)
      if (!shouldUpdate) shouldUpdate = true
    }
    if (shouldUpdate) {
      updatePromises.push(dbOpsGuilds.update(guildRss))
    }
  }
  await Promise.all(updatePromises)
}
