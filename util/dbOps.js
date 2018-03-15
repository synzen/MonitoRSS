const storage = require('./storage.js')
const config = require('../config.json')
const currentGuilds = storage.currentGuilds
const models = storage.models
const log = require('./logger.js')
const UPDATE_SETTINGS = { overwrite: true, upsert: true, strict: true }

exports.guildRss = {
  update: (guildRss, shardingManager, callback) => {
    models.GuildRss().update({ id: guildRss.id }, guildRss, UPDATE_SETTINGS, (err, res) => {
      if (err) {
        if (typeof callback === 'function') return callback(err)
        return log.general.error(`(G: ${guildRss.id}) Unable to update profile`, err)
      }
      if (typeof callback === 'function') callback()
      if (!process.send) currentGuilds.set(guildRss.id, guildRss) // Only do this for non-sharded instances since this function may not be called by a process that has this guild

      // For sharded instances. Other shards don't cache guilds that it doesn't have - it's just for the sharding manager to keep track
      if (shardingManager) shardingManager.broadcast({ type: 'updateGuild', guildRss: guildRss })
      else if (process.send) process.send({ type: 'updateGuild', guildRss: guildRss }) // If this is a child process
    })
  },
  remove: (guildId, shardingManager, callback) => {
    const guildRss = currentGuilds.get(guildId)
    models.GuildRss().find({ id: guildId }).remove((err, res) => {
      if (err && err.code !== 26) {
        if (typeof callback === 'function') callback(err)
        else log.general.warning(`Unable to remove GuildRss document ${guildId}`, err)
      }
      const rssList = guildRss ? guildRss.sources : undefined
      if (rssList) {
        for (let rssName in rssList) {
          exports.linkList.decrement(rssList[rssName].link, err => {
            if (err) log.general.warning(`Unable to decrement linkTracker for ${rssList[rssName].link}`, err)
          })
        }
      }
      currentGuilds.delete(guildId)
      if (shardingManager) shardingManager.broadcast({type: 'deleteGuild', guildId: guildId})
      else if (process.send) process.send({type: 'deleteGuild', guildId: guildId}) // If this is a child process
      if (guildRss && guildRss.sources && Object.keys(guildRss.sources).length > 0) models.GuildRssBackup().update({ id: guildId }, guildRss, UPDATE_SETTINGS, (err, res) => callback(err))
      if (typeof callback === 'function') callback()
      else log.general.info(`Removed GuildRss document ${guildId}`)
    })
  },
  removeFeed: (guildRss, rssName, callback) => {
    const link = guildRss.sources[rssName].link
    exports.linkList.decrement(link, err => {
      if (err) log.general.warning('Unable to decrement link for guildRss.removeFeed dbOps', err)
      delete guildRss.sources[rssName]
      exports.guildRss.update(guildRss)
      exports.guildRss.empty(guildRss)
      storage.deletedFeeds.push(rssName)
      callback(null, link)
    })
  },
  restore: (guildId, shardingManager, callback) => {
    models.GuildRssBackup().find({ id: guildId }, (err, docs) => {
      if (err) return callback(err)
      if (docs.length === 0) return
      exports.guildRss.update(docs[0], shardingManager, err => {
        callback(err)
        if (err) return
        const rssList = docs[0].sources
        if (rssList) {
          for (var rssName in rssList) {
            exports.linkList.increment(rssList[rssName].link, err => {
              if (err) log.general.warning(`Unable to increment linkList for ${rssList[rssName]}`, err)
            })
          }
        }
        models.GuildRssBackup().find({ id: guildId }).remove((err, res) => {
          if (err) log.general.warning(`(G: ${guildId}) Unable to remove backup for guild after restore`, err)
        })
      })
    })
  },
  empty: (guildRss, shardingManager) => { // Used on the beginning of each cycle to check for empty sources per guild
    if (guildRss.sources && Object.keys(guildRss.sources).length > 0) return false
    if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage) { // Delete only if server-specific special settings are not found
      exports.guildRss.remove(guildRss.id, shardingManager, err => {
        if (err) return log.general.error(`(G: ${guildRss.id}) Could not delete guild due to 0 sources`, err)
        log.general.info(`(G: ${guildRss.id}) 0 sources found with no custom settings deleted`)
      })
    } else log.general.info(`(G: ${guildRss.id}) 0 sources found, skipping`)
    return true
  }
}

exports.linkList = {
  write: (linkCounts, callback) => {
    const data = []
    for (var l in linkCounts) data.push({ link: l, count: linkCounts[l] })
    if (data.length === 0) {
      if (typeof callback === 'function') callback()
      return
    }
    models.LinkTracker().collection.insert(data, callback)
  },
  get: callback => {
    models.LinkTracker().find({}, (err, docs) => {
      if (err) return callback(err)
      const linkCounts = {}
      for (var i = 0; i < docs.length; ++i) {
        const doc = docs[i]
        linkCounts[doc.link] = doc.count
      }
      callback(null, linkCounts)
    })
  },
  update: (linkCount, callback) => {
    if (linkCount.count > 0) models.LinkTracker().update({ link: linkCount.link }, linkCount, UPDATE_SETTINGS, callback)
    else {
      models.LinkTracker().find({ link: linkCount.link }).remove(err => {
        if (err && err.code !== 26) return callback(err)
        callback()
      })
    }
  },
  drop: callback => {
    models.LinkTracker().collection.drop(callback)
  },
  decrement: (link, callback) => {
    exports.linkList.get((err, linkCounts) => {
      if (err) return callback(err)
      if (!linkCounts[link]) return callback()
      if (--linkCounts[link] === 0) {
        models.Feed(link).collection.drop(err => {
          if (err && err.code !== 26) log.general.warning(`Could not drop collection ${storage.collectionId(link)} after decrementing linkTracker`, err)
        })
      }
      exports.linkList.update({ link: link, count: linkCounts[link] }, callback)
    })
  },
  increment: (link, callback) => {
    exports.linkList.get((err, linkCounts) => {
      if (err) return callback(err)
      if (!linkCounts[link]) linkCounts[link] = 1
      else ++linkCounts[link]
      exports.linkList.update({ link: link, count: linkCounts[link] }, callback)
    })
  }
}

exports.blacklists = {
  get: callback => models.Blacklist().find(callback),
  add: (settings, callback) => {
    models.Blacklist().update({ id: settings.id }, settings, UPDATE_SETTINGS, err => {
      if (err && typeof callback === 'function') return callback(err)
      else if (err) return log.general.error(`Unable to add blacklist for id ${settings.id}`, err)
      const blacklistGuilds = storage.blacklistGuilds
      const blacklistUsers = storage.blacklistUsers

      if (settings.isGuild) blacklistGuilds.push(settings.id)
      else blacklistUsers.push(settings.id)

      if (process.send) process.send({ type: 'updateBlacklists', blacklistUsers: blacklistUsers, blacklistGuilds: blacklistGuilds })
      if (typeof callback === 'function') callback()
    })
  },
  remove: (id, callback) => {
    models.Blacklist().find({ id: id }).remove((err, doc) => {
      if (err && typeof callback === 'function') return callback(err)
      else if (err) return log.general.error(`Unable to remove blacklist for id ${id}`, err)
      const blacklistGuilds = storage.blacklistGuilds
      const blacklistUsers = storage.blacklistUsers

      if (doc.isGuild) blacklistGuilds.splice(blacklistGuilds.indexOf(doc.id), 1)
      else blacklistUsers.splice(blacklistUsers.indexOf(doc.id), 1)

      if (process.send) process.send({ type: 'updateBlacklists', blacklistUsers: blacklistUsers, blacklistGuilds: blacklistGuilds })
      if (typeof callback === 'function') callback()
    })
  }
}

exports.vips = {
  get: callback => models.VIP().find(callback),
  update: (settings, callback) => {
    models.VIP().update({ id: settings.id }, settings, { upsert: true, strict: true }, err => {
      if (err && typeof callback === 'function') return callback(err)
      else if (err) return log.general.error(`Unable to add VIP for id ${settings.id}`, err)
      const limitOverrides = storage.limitOverrides
      const cookieServers = storage.cookieServers
      const webhookServers = storage.webhookServers
      const DEF_MAX = config.feeds.maxFeeds

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
  },
  remove: (id, callback) => {
    models.VIP().find({ id: id }).remove((err, doc) => {
      if (err && typeof callback === 'function') return callback(err)
      else if (err) return log.general.error(`Unable to add VIP for id ${id}`, err)
      const limitOverrides = storage.limitOverrides
      const cookieServers = storage.cookieServers
      const webhookServers = storage.webhookServers

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
  },
  refresh: callback => {
    models.VIP().find((err, docs) => {
      if (err && typeof callback === 'function') return callback(err)
      else if (err) return log.general.error(`Unable to query VIPs for refresh`, err)
      const limitOverrides = storage.limitOverrides
      const webhookServers = storage.webhookServers
      const cookieServers = storage.cookieServers
      Object.keys(limitOverrides).forEach(id => delete limitOverrides[id])
      webhookServers.length = 0
      cookieServers.length = 0
      const DEF_MAX = config.feeds.max

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
}
