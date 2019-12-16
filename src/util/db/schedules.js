const config = require('../../config.js')
const Schedule = require('../../models/Schedule.js')
const AssignedSchedule = require('../../models/AssignedSchedule.js')
const UPDATE_SETTINGS = { upsert: true, strict: true }
const FIND_PROJECTION = '-_id -__v'

exports.schedules = {
  add: async (name, refreshRateMinutes, keywords, rssNames) => {
    if (!config.database.uri.startsWith('mongo')) return
    const toAdd = { name, refreshRateMinutes, keywords, rssNames }
    const ScheduleModel = Schedule.model()
    const schedule = new ScheduleModel(toAdd)
    await schedule.save()
    return schedule
  },
  get: async name => {
    if (!config.database.uri.startsWith('mongo')) return
    return Schedule.model().findOne({ name }).lean().exec()
  },
  getAll: async () => {
    if (!config.database.uri.startsWith('mongo')) return
    return Schedule.model().find({}).lean().exec()
  },
  clear: async () => {
    if (!config.database.uri.startsWith('mongo')) return
    try {
      await Schedule.model().deleteMany({})
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
    return AssignedSchedule.model().findOne(conditions, FIND_PROJECTION).lean().exec()
  },
  getMany: async (shard, schedule, link) => {
    if (!config.database.uri.startsWith('mongo')) return []
    const conditions = {}
    if (shard != null) conditions.shard = shard
    if (schedule) conditions.schedule = schedule
    if (link) conditions.link = link
    if (Object.keys(conditions).length === 0) throw new Error('No conditions set for find')
    return AssignedSchedule.model().find(conditions, FIND_PROJECTION).lean().exec()
  },
  getAll: async () => {
    if (!config.database.uri.startsWith('mongo')) return []
    return AssignedSchedule.model().find({}, FIND_PROJECTION).lean().exec()
  },
  getManyByIDs: async ids => {
    if (!config.database.uri.startsWith('mongo')) return []
    if (!Array.isArray(ids)) throw new Error('ids is not an array')
    return AssignedSchedule.model().find({ feedID: { $in: ids } }, FIND_PROJECTION).lean().exec()
  },
  set: async (feedID, scheduleName, link, guildID, shardId) => {
    if (!config.database.uri.startsWith('mongo')) return
    // const shard = storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : undefined
    const exists = await exports.schedules.get(scheduleName)
    if (!exists) throw new Error(`Schedule ${scheduleName} does not exist`)
    const toSet = { feedID, schedule: scheduleName, link, guildID, shard: Number(shardId) }
    return AssignedSchedule.model().findOneAndUpdate({ feedID }, { $set: toSet }, { ...UPDATE_SETTINGS, new: true }).lean().exec()
  },
  setMany: async docs => {
    if (!config.database.uri.startsWith('mongo')) return
    return AssignedSchedule.model().insertMany(docs)
  },
  remove: async feedID => {
    if (!config.database.uri.startsWith('mongo')) return
    await AssignedSchedule.model().deleteOne({ feedID })
  },
  clear: async () => {
    if (!config.database.uri.startsWith('mongo')) return
    try {
      await AssignedSchedule.model().deleteMany({})
    } catch (err) {
      if (err.code !== 26) throw err
    }
  }
}
