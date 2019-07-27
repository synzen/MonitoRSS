const storage = require('../storage.js')
const config = require('../../config.js')
const models = storage.models
const UPDATE_SETTINGS = { upsert: true, strict: true }
const FIND_PROJECTION = '-_id -__v'

exports.clear = async () => {
  if (!config.database.uri.startsWith('mongo')) return
  try {
    await models.Statistics().deleteMany({})
  } catch (err) {
    if (err.code !== 26) throw err // 26 means collection does not exist
  }
}

exports.get = async (shard = 0) => {
  if (!config.database.uri.startsWith('mongo')) return
  return models.Statistics().findOne({ shard }, FIND_PROJECTION).lean().exec()
}

exports.getAll = async () => {
  if (!config.database.uri.startsWith('mongo')) return []
  return models.Statistics().find({}, FIND_PROJECTION).lean().exec()
}

exports.update = async data => {
  if (!config.database.uri.startsWith('mongo')) return
  const shard = data.shard || 0
  const shardStats = await exports.get(shard)
  if (!shardStats) return models.Statistics().updateOne({ shard }, { $set: data }, UPDATE_SETTINGS).exec()
  data.cycleTime = (shardStats.cycleTime + data.cycleTime) / 2
  data.cycleFails = (shardStats.cycleFails + data.cycleFails) / 2
  data.cycleLinks = (shardStats.cycleLinks + data.cycleLinks) / 2
  data.feeds = (shardStats.feeds + data.feeds) / 2
  return models.Statistics().updateOne({ shard }, { $set: data }, UPDATE_SETTINGS).exec()
}
