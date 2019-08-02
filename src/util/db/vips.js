const fs = require('fs')
const path = require('path')
const storage = require('../storage.js')
const config = require('../../config.js')
const VIP = require('../../models/VIP.js')
const log = require('../logger.js')
const UPDATE_SETTINGS = { upsert: true, strict: true }
const FIND_PROJECTION = '-_id -__v'
const dbOpsGuilds = require('./guilds.js')

exports.get = id => VIP.model().findOne({ id }, FIND_PROJECTION).lean().exec()

exports.getAll = async () => {
  if (!config.database.uri.startsWith('mongo')) return []
  return VIP.model().find({}, FIND_PROJECTION).lean().exec()
}

exports.update = async settings => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.update is not supported when config.database.uri is set to a databaseless folder path')
  if (!settings.name) {
    const dUser = storage.bot.users.get(settings.id)
    settings.name = dUser ? dUser.username : null
  }
  await VIP.model().updateOne({ id: settings.id }, { $set: settings }, UPDATE_SETTINGS).exec()
  log.general.success(`Updated VIP ${settings.id} (${settings.name})`)
}

exports.updateBulk = async vipUsers => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.updateBulk is not supported when config.database.uri is set to a databaseless folder path')
  let complete = 0
  const total = Object.keys(vipUsers).length
  let errored = false

  if (Object.keys(vipUsers).length === 0) return
  return new Promise((resolve, reject) => {
    for (var q in vipUsers) {
      const vipUser = vipUsers[q]
      const unsets = { }
      for (const field in vipUser) {
        if (vipUser[field] === null || vipUser[field] === undefined) {
          delete vipUser[field]
          if (!unsets.$unset) unsets.$unset = {}
          unsets.$unset[field] = 1
        }
      }
      VIP.model().updateOne({ id: vipUser.id }, { $set: vipUser, ...unsets }, UPDATE_SETTINGS).exec()
        .then(() => {
          log.general.success(`Bulk updated VIP ${vipUser.id} (${vipUser.name})`)
          if (++complete === total) return errored ? reject(new Error('Previous errors encountered with vips.updateBulk')) : resolve()
        })
        .catch(err => { // stringify and parse to prevent mongoose from modifying my object
          log.general.error(`Unable to add VIP for id ${vipUser.id}`, err, true)
          errored = true
          if (++complete === total) return errored ? reject(new Error('Previous errors encountered with vips.updateBulk')) : resolve()
        })
    }
  })
}

exports.remove = async id => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.remove is not supported when config.database.uri is set to a databaseless folder path')
  await VIP.model().deleteOne({ id: id }).exec()
}

exports.addServers = async settings => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.addServers is not supported when config.database.uri is set to a databaseless folder path')
  const { serversToAdd, vipUser } = settings
  if (serversToAdd.length === 0) return
  for (const id of serversToAdd) {
    if (vipUser.servers.includes(id)) throw new Error(`Server ${id} already exists`)
    vipUser.servers.push(id)
    const guildRss = await dbOpsGuilds.get(id)
    if (guildRss) {
      const rssList = guildRss.sources
      if (rssList) {
        for (const rssName in rssList) {
          storage.scheduleManager.assignSchedule(rssName, guildRss).catch(err => log.general.error('Failed to assign schedules to newly added vip server feeds', err))
        }
      }
    }
    log.general.success(`VIP servers added for VIP ${vipUser.id} (${vipUser.name}): ${serversToAdd.join(',')}`)
  }
  await VIP.model().updateOne({ id: vipUser.id }, { $addToSet: { servers: { $each: serversToAdd } } }, UPDATE_SETTINGS).exec()
}

exports.removeServers = async settings => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.removeServers is not supported when config.database.uri is set to a databaseless folder path')
  const { serversToRemove, vipUser } = settings
  for (const id of serversToRemove) {
    const index = vipUser.servers.indexOf(id)
    if (index === -1) throw new Error(`Server ID ${id} not found`)
    vipUser.servers.splice(index, 1)
    const guildRss = await dbOpsGuilds.get(id)
    if (guildRss && guildRss.sources) {
      const rssList = guildRss.sources
      for (var rssName in rssList) {
        storage.scheduleManager.removeScheduleOfFeed(rssName, rssList[rssName].link).catch(err => log.general.error('Failed to remove schedules from removed vip server feeds', err))
      }
    }
    await VIP.model().updateOne({ id: vipUser.id }, { $pull: { servers: { $in: serversToRemove } } }, UPDATE_SETTINGS).exec()
  }
  log.general.success(`VIP servers removed from VIP ${vipUser.id} (${vipUser.name}): ${serversToRemove.join(',')}`)
}

exports.refresh = async (updateNamesFromRedis, vipApiData) => {
  if (!config._vip) return
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.refresh is not supported when config.database.uri is set to a databaseless folder path')
  if (!fs.existsSync(path.join(__dirname, '..', '..', '..', 'settings', 'vips.js'))) throw new Error('Missing VIP module')
  return require('../../../settings/vips.js')(storage.bot, vipApiData || await require('../../../settings/api.js')(), updateNamesFromRedis)
}

exports.isVipServer = async serverId => {
  if (!config._vip) return true
  const vipUser = (await exports.getAll()).filter(vipUser => vipUser.servers.includes(serverId) && vipUser.invalid !== true)[0]
  return !!vipUser
}
