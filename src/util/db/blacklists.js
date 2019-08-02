const storage = require('../storage.js')
const config = require('../../config.js')
const Blacklist = require('../../models/Blacklist.js')
const UPDATE_SETTINGS = { upsert: true, strict: true }

exports.uniformize = async (blacklistGuilds, blacklistUsers, skipProcessSend) => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.uniformize not supported when config.database.uri is set to a databaseless folder path')
  if (!skipProcessSend && storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'blacklists.uniformize', blacklistGuilds: blacklistGuilds, blacklistUsers: blacklistUsers, _loopback: true })
  else if (skipProcessSend) {
    storage.blacklistGuilds = blacklistGuilds
    storage.blacklistUsers = blacklistUsers
  }
}

exports.getAll = async () => {
  if (!config.database.uri.startsWith('mongo')) return []
  return Blacklist.model().find().lean().exec()
}

exports.add = async settings => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.add is not supported when config.database.uri is set to a databaseless folder path')
  await Blacklist.model().updateOne({ id: settings.id }, { $set: settings }, UPDATE_SETTINGS).exec()
  if (settings.isGuild) storage.blacklistGuilds.push(settings.id)
  else storage.blacklistUsers.push(settings.id)
  await exports.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
}

exports.remove = async id => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.remove is not supported when config.database.uri is set to a databaseless folder path')
  const doc = await Blacklist.model().deleteOne({ id: id })
  if (storage.blacklistGuilds.includes(id)) storage.blacklistGuilds.splice(storage.blacklistGuilds.indexOf(doc.id), 1)
  else storage.blacklistUsers.splice(storage.blacklistUsers.indexOf(doc.id), 1)
  await exports.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
}

exports.refresh = async () => {
  if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.refresh is not supported when config.database.uri is set to a databaseless folder path')
  const docs = await exports.getAll()
  for (var x = 0; x < docs.length; ++x) {
    const doc = docs[x]
    if (doc.isGuild) storage.blacklistGuilds.push(doc.id)
    else storage.blacklistUsers.push(doc.id)
  }
  await exports.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
}
