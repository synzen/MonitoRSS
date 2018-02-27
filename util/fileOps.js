const storage = require('./storage.js')
const config = require('../config.json')
const blacklistGuilds = storage.blacklistGuilds
const blacklistUsers = storage.blacklistUsers
const currentGuilds = storage.currentGuilds
const webhookServers = storage.webhookServers
const cookieServers = storage.cookieServers
const models = storage.models
const log = require('./logger.js')
const UPDATE_SETTINGS = { overwrite: true, upsert: true, strict: true }

exports.updateFile = (guildRss, shardingManager, callback) => {
  models.GuildRss().update({ id: guildRss.id }, guildRss, UPDATE_SETTINGS, (err, res) => {
    if (err) {
      if (typeof callback === 'function') return callback(err)
      return log.general.error(`(G: ${guildRss.id}) Unable to update profile`, err)
    }
    if (typeof callback === 'function') callback()
    if (!process.send) currentGuilds.set(guildRss.id, guildRss) // Only do this for non-sharded instances since this function may not be called by a process that has this guild

    // For sharded instances
    if (shardingManager) shardingManager.broadcast({ type: 'updateGuild', guildRss: guildRss })
    else if (process.send) process.send({ type: 'updateGuild', guildRss: guildRss }) // If this is a child process
  })
}

exports.deleteGuild = (guildId, shardingManager, callback) => {
  const guildRss = currentGuilds.get(guildId)
  models.GuildRss().find({ id: guildId }).remove((err, res) => {
    if (err) return callback(err)
    currentGuilds.delete(guildId)
    if (shardingManager) shardingManager.broadcast({type: 'deleteGuild', guildId: guildId})
    else if (process.send) process.send({type: 'deleteGuild', guildId: guildId}) // If this is a child process
    if (guildRss && guildRss.sources && Object.keys(guildRss.sources).length > 0) models.GuildRssBackup().update({ id: guildId }, guildRss, UPDATE_SETTINGS, (err, res) => callback(err))
  })
}

exports.isEmptySources = (guildRss, shardingManager) => { // Used on the beginning of each cycle to check for empty sources per guild
  if (guildRss.sources && Object.keys(guildRss.sources).length > 0) return false
  if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage) { // Delete only if server-specific special settings are not found
    exports.deleteGuild(guildRss.id, shardingManager, err => {
      if (err) return log.general.error(`(G: ${guildRss.id}) Could not delete guild due to 0 sourcee`, err)
      log.general.info(`(G: ${guildRss.id}) 0 sources found with no custom settings deleted`)
    })
  } else log.general.info(`(G: ${guildRss.id}) 0 sources found, skipping`)
  return true
}

exports.restoreBackup = (guildId, shardingManager, callback) => {
  models.GuildRssBackup().find({ id: guildId }, (err, docs) => {
    if (err) return callback(err)
    if (docs.length === 0) return
    exports.updateFile(docs[0], shardingManager, err => {
      callback(err)
      if (err) return
      models.GuildRssBackup().find({ id: guildId }).remove((err, res) => {
        if (err) log.general.warning(`(G: ${guildId}) Unable to remove backup for guild after restore`, err)
      })
    })
  })
}

exports.getBlacklists = callback => models.Blacklist().find(callback)

exports.addBlacklist = (settings, callback) => {
  models.Blacklist().update({ id: settings.id }, settings, UPDATE_SETTINGS, err => {
    if (err && typeof callback === 'function') return callback(err)
    else if (err) return log.general.error(`Unable to add blacklist for id ${settings.id}`, err)

    if (settings.isGuild) blacklistGuilds.push(settings.id)
    else blacklistUsers.push(settings.id)

    if (process.send) process.send({ type: 'updateBlacklists', blacklistUsers: blacklistUsers, blacklistGuilds: blacklistGuilds })
    if (typeof callback === 'function') callback()
  })
}

exports.removeBlacklist = (id, callback) => {
  models.Blacklist().find({ id: id }).remove((err, doc) => {
    if (err && typeof callback === 'function') return callback(err)
    else if (err) return log.general.error(`Unable to remove blacklist for id ${id}`, err)

    if (doc.isGuild) blacklistGuilds.splice(blacklistGuilds.indexOf(doc.id), 1)
    else blacklistUsers.splice(blacklistUsers.indexOf(doc.id), 1)

    if (process.send) process.send({ type: 'updateBlacklists', blacklistUsers: blacklistUsers, blacklistGuilds: blacklistGuilds })
    if (typeof callback === 'function') callback()
  })
}

exports.getVIP = callback => models.VIP().find(callback)

exports.updateVIP = (settings, callback) => {
  models.VIP().update({ id: settings.id }, settings, { upsert: true, strict: true }, err => {
    if (err && typeof callback === 'function') return callback(err)
    else if (err) return log.general.error(`Unable to add VIP for id ${settings.id}`, err)
    const limitOverrides = storage.limitOverrides
    const DEF_MAX = config.feedSettings.maxFeeds

    const servers = settings.servers
    if (servers) {
      for (var x = 0; x < servers.length; ++x) {
        const serverID = servers[x]
        if (settings.maxFeeds > DEF_MAX) limitOverrides[serverID] = settings.maxFeeds
        else delete limitOverrides[serverID]
        if (settings.allowWebhooks) webhookServers.push(serverID)
        else webhookServers.splice(webhookServers.indexOf(serverID))
        if (settings.allowCookies) cookieServers.push(serverID)
        else cookieServers.splice(cookieServers.indexOf(serverID))
      }
    }

    if (process.send) process.send({ type: 'updateVIPs', webhookServers: webhookServers, cookieServers: cookieServers, limitOverrides: limitOverrides })
    if (typeof callback === 'function') callback()
  })
}

exports.removeVIP = (id, callback) => {
  models.VIP().find({ id: id }).remove((err, doc) => {
    if (err && typeof callback === 'function') return callback(err)
    else if (err) return log.general.error(`Unable to add VIP for id ${id}`, err)
    const limitOverrides = storage.limitOverrides

    const servers = doc.servers
    if (servers) {
      for (var x = 0; x < servers.length; ++x) {
        const serverID = servers[x]
        delete limitOverrides[serverID]
        webhookServers.splice(webhookServers.indexOf(serverID))
        cookieServers.splice(cookieServers.indexOf(serverID))
      }
    }

    if (process.send) process.send({ type: 'updateVIPs', webhookServers: webhookServers, cookieServers: cookieServers, limitOverrides: limitOverrides })
    if (typeof callback === 'function') callback()
  })
}

exports.refreshVIP = callback => {
  models.VIP().find((err, docs) => {
    if (err && typeof callback === 'function') return callback(err)
    else if (err) return log.general.error(`Unable to query VIPs for refresh`, err)
    const limitOverrides = storage.limitOverrides

    Object.keys(limitOverrides).forEach(id => delete limitOverrides[id])
    webhookServers.length = 0
    cookieServers.length = 0
    const DEF_MAX = config.feedSettings.maxFeeds

    const len = docs.length
    for (var x = 0; x < len; ++x) {
      const doc = docs[x]
      const servers = doc.servers
      const sLen = servers.length
      for (var y = 0; y < sLen; ++y) {
        const serverID = servers[y]
        if (doc.maxFeeds > DEF_MAX) limitOverrides[serverID] = doc.maxFeeds
        if (doc.allowWebhooks) webhookServers.push(serverID)
        if (doc.allowCookies) cookieServers.push(serverID)
      }
    }

    if (process.send) process.send({ type: 'updateVIPs', webhookServers: webhookServers, cookieServers: cookieServers, limitOverrides: limitOverrides })
    if (typeof callback === 'function') callback()
  })
}
