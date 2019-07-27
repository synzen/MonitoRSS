const storage = require('../storage.js')
const config = require('../../config.js')
const models = storage.models
const UPDATE_SETTINGS = { upsert: true, strict: true }
const FIND_PROJECTION = '-_id -__v'

exports.schedules = {
  add: async (name, refreshRateMinutes) => {
    if (!config.database.uri.startsWith('mongo')) return
    return models.Schedule().updateOne({ name }, { name, refreshRateMinutes }, UPDATE_SETTINGS).exec()
  },
  get: async name => {
    if (!config.database.uri.startsWith('mongo')) return
    return models.Schedule().findOne({ name }).lean().exec()
  },
  getAll: async () => {
    if (!config.database.uri.startsWith('mongo')) return
    return models.Schedule().find({}).lean().exec()
  },
  clear: async () => {
    if (!config.database.uri.startsWith('mongo')) return
    try {
      await models.Schedule().deleteMany({})
    } catch (err) {
      if (err.code !== 26) throw err
    }
  }
}

exports.assignedSchedules = {
  get: async (feedID, shard) => { // shard = 0 is default
    if (!config.database.uri.startsWith('mongo')) return
    const conditions = { feedID }
    if (shard != null) conditions.shard = shard
    return models.AssignedSchedule().findOne(conditions, FIND_PROJECTION).lean().exec()
  },
  getMany: async (shard, schedule, link) => {
    if (!config.database.uri.startsWith('mongo')) return []
    const conditions = {}
    if (shard != null) conditions.shard = shard
    if (schedule) conditions.schedule = schedule
    if (link) conditions.link = link
    if (Object.keys(conditions).length === 0) throw new Error('No conditions set for find')
    return models.AssignedSchedule().find(conditions, FIND_PROJECTION).lean().exec()
  },
  getAll: async () => {
    if (!config.database.uri.startsWith('mongo')) return []
    return models.AssignedSchedule().find({}, FIND_PROJECTION).lean().exec()
  },
  getManyByIDs: async ids => {
    if (!config.database.uri.startsWith('mongo')) return []
    if (!Array.isArray(ids)) throw new Error('ids is not an array')
    return models.AssignedSchedule().find({ feedID: { $in: ids } }, FIND_PROJECTION).lean().exec()
  },
  set: async (feedID, scheduleName, link, guildID) => {
    if (!config.database.uri.startsWith('mongo')) return
    const shard = storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : -1
    const exists = await exports.schedules.get(scheduleName)
    if (!exists) throw new Error(`Schedule ${scheduleName} does not exist`)
    const toSet = { feedID, schedule: scheduleName, link, guildID, shard }
    return models.AssignedSchedule().updateOne({ feedID }, { $set: toSet }, UPDATE_SETTINGS).exec()
  },
  setMany: async docs => {
    if (!config.database.uri.startsWith('mongo')) return
    return models.AssignedSchedule().insertMany(docs)
  },
  remove: async feedID => {
    if (!config.database.uri.startsWith('mongo')) return
    await models.AssignedSchedule().deleteOne({ feedID })
  },
  clear: async () => {
    if (!config.database.uri.startsWith('mongo')) return
    try {
      await models.AssignedSchedule().deleteMany({})
    } catch (err) {
      if (err.code !== 26) throw err
    }
  }
}
