const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const Discord = require('discord.js')
const storage = require('./storage.js')
const config = require('../config.json')
const LinkTracker = require('../structs/LinkTracker.js')
const currentGuilds = storage.currentGuilds
const models = storage.models
const log = require('./logger.js')
const UPDATE_SETTINGS = { overwrite: true, upsert: true, strict: true }
const FAIL_LIMIT = config.feeds.failLimit

exports.guildRss = {
  getAll: callback => {
    // Memory Version
    if (!config.database.uri.startsWith('mongo')) {
      if (!fs.existsSync(path.join(config.database.uri))) return callback(null, [])
      return fs.readdir(path.join(config.database.uri), (err, fileNames) => {
        if (err) return callback(err)
        let done = 0
        let read = []
        const total = fileNames.length
        for (var x = 0; x < total; ++x) {
          const name = fileNames[x]
          if (name === 'backup') continue
          fs.readFile(path.join(config.database.uri, name), (err, data) => {
            if (err) {
              log.general.warning(`Could not read from source file ${name}`, err)
              return ++done === total ? callback(null, read) : null
            }
            try {
              read.push(JSON.parse(data))
            } catch (err) {
              log.general.warning(`Could not parse JSON from source file ${name}`, err)
            }
            return ++done === total ? callback(null, read) : null
          })
        }
      })
    }
    // Database version
    models.GuildRss().find(callback)
  },
  update: (guildRss, callback, skipProcessSend) => {
    if (storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      process.send({ _drss: true, type: 'guildRss.update', guildRss: guildRss, _loopback: true })
      return callback ? callback() : null
    }
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
      try {
        if (!fs.existsSync(path.join(config.database.uri))) fs.mkdirSync(path.join(config.database.uri))
        fs.writeFileSync(path.join(config.database.uri, `${guildRss.id}.json`), JSON.stringify(guildRss, null, 2))
      } catch (err) {
        return callback ? callback(err) : log.general.error(`(G: ${guildRss.id}) Unable to update profile`, err)
      }
      currentGuilds.set(guildRss.id, guildRss)
      exports.guildRss.empty(guildRss, false, skipProcessSend)
      return callback ? callback() : null
    }
    // Database version
    models.GuildRss().update({ id: guildRss.id }, guildRss, UPDATE_SETTINGS, (err, res) => {
      if (err) return callback ? callback(err) : log.general.error(`(G: ${guildRss.id}) Unable to update profile`, err)
      currentGuilds.set(guildRss.id, guildRss)
      exports.guildRss.empty(guildRss, false, skipProcessSend)
      if (callback) callback()
    })
  },
  remove: (guildRss, callback, skipProcessSend) => {
    const guildId = guildRss.id
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      process.send({ _drss: true, type: 'guildRss.remove', guildRss: guildRss, _loopback: true })
      return callback ? callback() : null
    }
    if (guildRss && guildRss.sources && Object.keys(guildRss.sources).length > 0) exports.guildRss.backup(guildRss)
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
      try {
        fs.unlinkSync(path.join(config.database.uri, `${guildId}.json`))
      } catch (err) {
        return callback ? callback(err) : log.general.warning(`Unable to remove GuildRss ${guildId}`, err)
      }
      const rssList = guildRss ? guildRss.sources : undefined
      if (rssList) {
        for (let rssName in rssList) {
          exports.linkTracker.decrement(rssList[rssName].link, err => {
            if (err) log.general.warning(`Unable to decrement linkTracker for ${rssList[rssName].link}`, err)
          })
        }
      }
      currentGuilds.delete(guildId)
      return callback ? callback() : log.general.info(`Removed GuildRss ${guildId}`)
    }
    // Database version
    models.GuildRss().find({ id: guildId }).remove((err, res) => {
      if (err && err.code !== 26) return callback ? callback(err) : log.general.warning(`Unable to remove GuildRss document ${guildId}`, err)
      const rssList = guildRss ? guildRss.sources : undefined
      if (rssList) {
        for (let rssName in rssList) {
          exports.linkTracker.decrement(rssList[rssName].link, err => {
            if (err) log.general.warning(`Unable to decrement linkTracker for ${rssList[rssName].link}`, err)
          })
        }
      }
      currentGuilds.delete(guildId)
      return callback ? callback() : log.general.info(`Removed GuildRss document ${guildId}`)
    })
  },
  disableFeed: (guildRss, rssName, callback, skipProcessSend) => {
    const link = guildRss.sources[rssName].link
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      process.send({ _drss: true, type: 'guildRss.disableFeed', guildRss: guildRss, rssName: rssName, _loopback: true })
      return callback ? callback(null, link) : log.general.warning(`Feed named ${rssName} has been disabled in guild ${guildRss.id}`)
    }
    if (guildRss.sources[rssName].disabled === true) return callback ? callback(null, link) : log.general.warning(`Feed named ${rssName} has been disabled in guild ${guildRss.id}`)
    guildRss.sources[rssName].disabled = true
    exports.guildRss.update(guildRss)
  },
  enableFeed: (guildRss, rssName, callback, skipProcessSend) => {
    const link = guildRss.sources[rssName].link
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      process.send({ _drss: true, type: 'guildRss.enableFeed', guildRss: guildRss, rssName: rssName, _loopback: true })
      return callback ? callback(null, link) : log.general.info(`Feed named ${rssName} has been enabled in guild ${guildRss.id}`)
    }
    if (guildRss.sources[rssName].disabled == null) return callback ? callback(null, link) : log.general.info(`Feed named ${rssName} has been enabled in guild ${guildRss.id}`)
    delete guildRss.sources[rssName].disabled
    exports.guildRss.update(guildRss)
  },
  removeFeed: (guildRss, rssName, callback, skipProcessSend) => {
    const link = guildRss.sources[rssName].link
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      process.send({ _drss: true, type: 'guildRss.removeFeed', guildRss: guildRss, rssName: rssName, _loopback: true })
      return callback ? callback(null, link) : null
    }
    delete guildRss.sources[rssName]
    exports.guildRss.update(guildRss)
    storage.deletedFeeds.push(rssName)
    exports.linkTracker.decrement(link, err => {
      if (err) log.general.warning('Unable to decrement link for guildRss.removeFeed dbOps', err)
      return callback ? callback(null, link) : !skipProcessSend ? log.general.info(`Feed ${link} has been removed from guild ${guildRss.id} (${guildRss.name})`) : null
    })
  },
  backup: (guildRss, callback) => {
    if (!guildRss || exports.guildRss.empty(guildRss, true)) return callback ? callback() : null
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
      if (!fs.existsSync(path.join(config.database.uri, 'backup'))) {
        try {
          fs.mkdirSync(path.join(config.database.uri, 'backup'))
        } catch (err) {
          return callback ? callback(err) : log.general.warning(`Unable to guildRss.backup guild ${guildRss.id}`, err)
        }
      }
      fs.writeFile(path.join(config.database.uri, 'backup', `${guildRss.id}.json`), JSON.stringify(guildRss, null, 2), err => {
        return callback ? callback(err) : err ? log.general.warning(`Unable to guildRss.backup guild ${guildRss.id}`, err) : log.general.info(`Backed up guild ${guildRss.id}`)
      })
    }
    // Database version
    models.GuildRssBackup().update({ id: guildRss.id }, guildRss, UPDATE_SETTINGS, (err, res) => {
      return callback ? callback(err) : err ? log.general.warning(`Unable to guildRss.backup guild ${guildRss.id}`, err) : log.general.info(`Backed up guild ${guildRss.id}`)
    })
  },
  restore: (guildId, callback, skipProcessSend) => {
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
      if (!fs.existsSync(path.join(config.database.uri, 'backup', `${guildId}.json`))) return callback ? callback() : null
      try {
        const json = JSON.parse(fs.readFile(path.join(config.database.uri, 'backup', `${guildId}.json`)))
        if (exports.guildRss.empty(json, true)) return callback ? callback() : null
        update(json)
      } catch (err) {
        return callback ? callback(err) : log.general.warning(`Could not read ${guildId}.json from backups folder for restore operation`, err)
      }
    }
    // Database version
    models.GuildRssBackup().find({ id: guildId }, (err, docs) => {
      if (err) return callback ? callback(err) : null
      if (docs.length === 0 || exports.guildRss.empty(docs[0], true)) return callback ? callback() : null
      update(docs[0])
    })

    function update (guildRss) {
      exports.guildRss.update(guildRss, err => {
        if (err) return callback ? callback(err) : null
        const rssList = guildRss.sources
        if (rssList) {
          for (var rssName in rssList) {
            const source = rssList[rssName]
            if (!storage.bot.channels.get(source.channel)) {
              exports.guildRss.removeFeed(guildRss, rssName, err => {
                if (err) return log.general.warning(`Could not remove feed ${source.link} due to missing channel ${source.channel}`, storage.bot.guilds.get(guildRss.id), err)
                log.general.info(`Removed feed ${source.link} due to missing channel ${source.channel}`, storage.bot.guilds.get(guildRss.id))
              }, skipProcessSend)
            } else {
              exports.linkTracker.increment(source.link, err => {
                if (err) log.general.warning(`Unable to increment linkTracker for ${source.link}`, err)
              })
            }
          }
        }
        models.GuildRssBackup().find({ id: guildId }).remove((err, res) => {
          if (err) log.general.warning(`(G: ${guildId}) Unable to remove backup for guild after restore`, err)
        })
        if (callback) callback(null, guildRss)
      }, skipProcessSend)
    }
  },
  empty: (guildRss, skipRemoval, skipProcessSend) => { // Used on the beginning of each cycle to check for empty sources per guild
    if (guildRss.sources && Object.keys(guildRss.sources).length > 0) return false
    if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage) { // Delete only if server-specific special settings are not found
      if (!skipRemoval) {
        exports.guildRss.remove(guildRss, err => {
          if (err) return log.general.error(`(G: ${guildRss.id}) Could not delete guild due to 0 sources`, err)
          log.general.info(`(G: ${guildRss.id}) 0 sources found with no custom settings deleted`)
        }, skipProcessSend)
      }
    } else log.general.info(`(G: ${guildRss.id}) 0 sources found, skipping`)
    return true
  }
}

exports.guildRssBackup = {
  dropIndexes: callback => models.GuildRssBackup().collection.dropIndexes(callback)
}

exports.feeds = {
  dropIndexes: (link, shardId, callback) => models.Feed(link, shardId).collection.dropIndexes(callback)
}

exports.linkTracker = {
  write: (linkTracker, callback) => {
    if (!(linkTracker instanceof LinkTracker)) return callback ? callback(new TypeError('linkTracker argument is not instance of LinkTracker')) : log.general.warning('Unable to linkTracker.write due to linkTracker argument not being an instance of LinkTracker')
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    models.LinkTracker().collection.drop(err => {
      if (err && err.code !== 26) return callback(err)
      const docs = linkTracker.toDocs()
      if (docs.length === 0) return callback ? callback() : undefined
      models.LinkTracker().collection.insert(docs, callback)
    })
  },
  get: callback => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(null, new LinkTracker()) : null
    models.LinkTracker().find({}, (err, docs) => {
      if (err) return callback(err)
      callback(null, new LinkTracker(docs, storage.bot))
    })
  },
  update: (link, count, callback) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    const shardId = storage.bot && storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : undefined
    if (count > 0) models.LinkTracker().update({ link: link, shard: shardId }, { link: link, count: count, shard: shardId }, UPDATE_SETTINGS, callback)
    else {
      models.LinkTracker().find({ link, shard: shardId }).remove(err => {
        if (err && err.code !== 26) return callback(err)
        callback()
      })
    }
  },
  decrement: (link, callback) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    exports.linkTracker.get((err, linkTracker) => {
      if (err) return callback(err)
      if (!linkTracker.get(link)) return callback()

      if (!linkTracker.decrement(link)) {
        models.Feed(link, linkTracker.shardId).collection.drop(err => {
          if (err && err.code !== 26) log.general.warning(`Could not drop collection ${storage.collectionId(link, linkTracker.shardId)} after decrementing linkTracker`, err)
        })
        exports.failedLinks.reset(link)
      }
      exports.linkTracker.update(link, linkTracker.get(link), callback)
    })
  },
  increment: (link, callback) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    exports.linkTracker.get((err, linkTracker) => {
      if (err) return callback(err)
      linkTracker.increment(link)
      exports.linkTracker.update(link, linkTracker.get(link), callback)
    })
  }
}

exports.failedLinks = {
  uniformize: (failedLinks, callback, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    if (!skipProcessSend && storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'failedLinks.uniformize', failedLinks: failedLinks, _loopback: true })
    else if (skipProcessSend) storage.failedLinks = failedLinks // skipProcessSend indicates that this method was called on another shard, otherwise it was already updated in the methods below
    if (callback) callback()
  },
  _sendAlert: (link, message, skipProcessSend) => {
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) return process.send({ _drss: true, type: 'failedLinks._sendAlert', link: link, message: message, _loopback: true })
    currentGuilds.forEach(guildRss => {
      const rssList = guildRss.sources
      if (!rssList) return
      for (var i in rssList) {
        const source = rssList[i]
        const channel = storage.bot.channels.get(source.channel)
        if (source.link === link && channel && config._skipMessages !== true) {
          const attach = channel.guild.me.permissionsIn(channel).has('ATTACH_FILES')
          const m = attach ? `${message}\n\nA backup for this server at this point in time has been attached in case this feed is subjected to forced removal in the future.` : message
          if (config._skipMessages !== true) channel.send(m, attach && currentGuilds.has(channel.guild.id) ? new Discord.Attachment(Buffer.from(JSON.stringify(currentGuilds.get(channel.guild.id), null, 2)), `${channel.guild.id}.json`) : null).catch(err => log.general.warning(`Unable to send limit notice for feed ${link}`, channel.guild, channel, err))
        }
      }
    })
  },
  initalize: (callback, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    models.FailedLink().find({}, (err, docs) => {
      if (err) return callback ? callback(err) : log.general.error('Unable to get failedLinks', err)
      const temp = {}
      for (var i = 0; i < docs.length; ++i) temp[docs[i].link] = docs[i].failed || docs[i].count
      storage.failedLinks = temp
      exports.failedLinks.uniformize(storage.failedLinks, callback, skipProcessSend)
    })
  },
  increment: (link, callback, skipProcessSend) => {
    if (FAIL_LIMIT === 0 || !config.database.uri.startsWith('mongo')) return callback ? callback() : null
    if (typeof storage.failedLinks[link] === 'string') return storage.initialized ? log.general.warning(`Cannot increment failed link ${link} since it has already failed.`) : null
    storage.failedLinks[link] = storage.failedLinks[link] == null ? 1 : storage.failedLinks[link] + 1
    if (storage.failedLinks[link] >= FAIL_LIMIT) {
      exports.failedLinks.fail(link, err => {
        if (err) return log.general.warning(`Unable to mark failed link ${link}`, err)
        log.cycle.error(`${link} has passed the fail limit (${FAIL_LIMIT}). Will no longer retrieve.`)
        if (config.feeds.notifyFail === true) exports.failedLinks._sendAlert(link, `**ATTENTION** - Feed link <${link}> has reached the connection failure limit and will not be retried until it is manually refreshed by this server, or another server using this feed. See \`${config.bot.prefix}rsslist\` for more information.`)
      })
    } else {
      storage.models.FailedLink().update({ link: link }, { link: link, count: storage.failedLinks[link] }, UPDATE_SETTINGS, (err, res) => {
        if (err) log.general.error('Unable to increment failed feed document in collection', err)
      })
    }
    exports.failedLinks.uniformize(storage.failedLinks, callback, skipProcessSend)
  },
  fail: (link, callback, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    const now = new Date().toString()
    storage.failedLinks[link] = now
    storage.models.FailedLink().update({ link: link }, { link: link, failed: now }, UPDATE_SETTINGS, (err, res) => {
      if (err) return callback ? callback(err) : log.general.error(`Unable to update document to mark failed for link ${link}`, err)
      exports.failedLinks.uniformize(storage.failedLinks, callback, skipProcessSend)
    })
  },
  reset: (link, callback, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    if (storage.failedLinks[link] == null) return callback ? callback() : null
    delete storage.failedLinks[link]
    storage.models.FailedLink().find({ link: link }).remove(err => {
      if (err && err.code !== 26) return callback ? callback(err) : log.general.error(`Unable to remove document to reset status for failed link ${link}`, err)
      exports.failedLinks.uniformize(storage.failedLinks, callback, skipProcessSend)
    })
  }
}

exports.blacklists = {
  uniformize: (blacklistGuilds, blacklistUsers, callback, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.blacklists.uniformize not supported when config.database.uri is set to a databaseless folder path')) : null
    if (!skipProcessSend && storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'blacklists.uniformize', blacklistGuilds: blacklistGuilds, blacklistUsers: blacklistUsers, _loopback: true })
    else if (skipProcessSend) {
      storage.blacklistGuilds = blacklistGuilds
      storage.blacklistUsers = blacklistUsers
    }
    if (callback) callback()
  },
  get: callback => {
    if (!config.database.uri.startsWith('mongo')) return callback(null, [])
    models.Blacklist().find(callback)
  },
  add: (settings, callback) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.blacklists.add is not supported when config.database.uri is set to a databaseless folder path')) : null
    models.Blacklist().update({ id: settings.id }, settings, UPDATE_SETTINGS, err => {
      if (err) return callback ? callback(err) : log.general.error(`Unable to add blacklist for id ${settings.id}`, err)
      if (settings.isGuild) storage.blacklistGuilds.push(settings.id)
      else storage.blacklistUsers.push(settings.id)
      exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers, callback)
    })
  },
  remove: (id, callback) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.blacklists.remove is not supported when config.database.uri is set to a databaseless folder path')) : null
    models.Blacklist().find({ id: id }).remove((err, doc) => {
      if (err) return callback ? callback(err) : log.general.error(`Unable to remove blacklist for id ${id}`, err)
      if (storage.blacklistGuilds.includes(id)) storage.blacklistGuilds.splice(storage.blacklistGuilds.indexOf(doc.id), 1)
      else storage.blacklistUsers.splice(storage.blacklistUsers.indexOf(doc.id), 1)
      exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers, callback)
    })
  },
  refresh: callback => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.blacklists.refresh is not supported when config.database.uri is set to a databaseless folder path')) : null
    exports.blacklists.get((err, docs) => {
      if (err) return callback ? callback(err) : log.general.error('Unable to refresh blacklists', err)
      for (var x = 0; x < docs.length; ++x) {
        const doc = docs[x]
        if (doc.isGuild) storage.blacklistGuilds.push(doc.id)
        else storage.blacklistUsers.push(doc.id)
      }
      exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers, callback)
    })
  }
}

exports.vips = {
  uniformize: (vipUsers, vipServers, callback, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.vips.uniformize is not supported when config.database.uri is set to a databaseless folder path')) : null
    if (!skipProcessSend && storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'vips.uniformize', vipUsers: vipUsers, vipServers: vipServers, _loopback: true })
    else if (skipProcessSend) {
      storage.vipUsers = vipUsers
      storage.vipServers = vipServers
    }
    if (callback) callback()
  },
  get: callback => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(null, []) : null
    models.VIP().find(callback)
  },
  update: (settings, callback, skipAddServers) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.vips.update is not supported when config.database.uri is set to a databaseless folder path')) : null
    const servers = settings.servers
    storage.vipUsers[settings.id] = settings
    if (servers && !skipAddServers) exports.vips.addServers({ ...settings, serversToAdd: servers }, null, true)
    exports.vips.uniformize(storage.vipUsers, storage.vipServers, callback)
    if (!settings.name) {
      const dUser = storage.bot.users.get(settings.id)
      settings.name = dUser ? dUser.username : null
    }
    delete settings.__v // Deleting this automatically solves an annoying error "Updating the path '__v' would create a conflict at '__v'"
    models.VIP().update({ id: settings.id }, settings, { upsert: true, strict: true }, err => {
      if (err) return callback ? callback(err) : log.general.error(`Unable to add VIP for id ${settings.id}`, err)
      if (callback) callback()
      log.general.success(`Updated VIP ${settings.id} (${settings.name})`)
    })
  },
  updateBulk: (settingsMultiple, callback) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.vips.updateBulk is not supported when config.database.uri is set to a databaseless folder path')) : null
    let complete = 0
    const total = Object.keys(settingsMultiple).length
    let errored = false
    for (var e in settingsMultiple) {
      const settings = settingsMultiple[e]
      if (!settings.name) {
        const dUser = storage.bot.users.get(settings.id)
        settings.name = dUser ? dUser.username : null
      }
      storage.vipUsers[settings.id] = settings
    }
    exports.vips.uniformize(storage.vipUsers, storage.vipServers)

    for (var q in settingsMultiple) {
      const settings = settingsMultiple[q]
      const servers = settings.servers
      if (servers) exports.vips.addServers({ ...settings, serversToAdd: servers }, null, true)
      delete settings.__v
      models.VIP().update({ id: settings.id }, settings, { upsert: true, strict: true }, err => {
        if (err) {
          log.general.error(`Unable to add VIP for id ${settings.id}`, err)
          errored = true
        } else log.general.success(`Bulk updated VIP ${settings.id} (${settings.name})`)
        if (++complete === total && callback) callback(errored ? new Error('Errors encountered with vips.updateBulk logged') : null)
      })
    }
  },
  remove: (id, callback, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.vips.remove is not supported when config.database.uri is set to a databaseless folder path')) : null
    models.VIP().find({ id: id }).remove((err, doc) => {
      if (err) return callback ? callback(err) : log.general.error(`Unable to remove VIP for id ${id}`, err)
      const settings = { ...storage.vipUsers[id] }
      delete storage.vipUsers[id]
      const servers = doc.servers
      if (servers) exports.vips.removeServers({ ...settings, serversToRemove: servers }, null, true)
    })
  },
  addServers: (settings, callback, skipUpdateVIP) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.vips.addServers is not supported when config.database.uri is set to a databaseless folder path')) : null
    const servers = settings.serversToAdd
    if (storage.bot.shard && storage.bot.shard.count > 0) {
      storage.bot.shard.broadcastEval(`
        const ids = ${JSON.stringify(servers)};
        const info = {}
        for (var x = 0; x < ids.length; ++x) {
          const guild = this.guilds.get(ids[x]);
          if (guild) info[guild.id] = guild.name
        }
        if (Object.keys(info).length > 0) info
      `).then(results => {
        let validServers = {}
        const invalidServers = []
        for (var x = 0; x < results.length; ++x) {
          if (results[x]) validServers = { ...validServers, ...results[x] }
        }
        for (var y = 0; y < servers.length; ++y) {
          const id = servers[y]
          if (!validServers[id]) {
            invalidServers.push(id)
            log.general.warning(`Failed to add VIP backing to server ${id} due to missing guild`)
          }
        }
        delete settings.serversToAdd
        write(validServers, invalidServers)
      }).catch(err => {
        if (callback) callback(err)
        log.general.error('Failed to broadcast eval for addServer', err)
      })
    } else {
      const validServers = {}
      const invalidServers = []
      for (var x = 0; x < servers.length; ++x) {
        const id = servers[x]
        const guild = storage.bot.guilds.get(id)
        if (guild) validServers[id] = guild.name
        else invalidServers.push(id)
      }
      delete settings.serversToAdd
      write(validServers, invalidServers)
    }
    function write (validServers, invalidServers) {
      for (var id in validServers) {
        const guildName = validServers[id]
        storage.vipServers[id] = {
          name: guildName,
          benefactor: settings
        }
        if (settings.expireAt) storage.vipServers[id].expireAt = new Date(settings.expireAt)
        if (!storage.vipUsers[settings.id].servers.includes(id)) storage.vipUsers[settings.id].servers.push(id)
        log.general.success(`Added VIP backing to server ${id} (${guildName}). Benefactor ID ${settings.id} (${settings.name}).`)
      }
      if (Object.keys(validServers).length > 0 && storage.scheduleManager) exports.vips.refreshVipSchedule()
      if (skipUpdateVIP) exports.vips.uniformize(storage.vipUsers, storage.vipServers)
      else exports.vips.update(storage.vipUsers[settings.id], null, true) // Uniformize is called by vips.update so no need to explicitly call it here
      if (callback) callback(null, validServers, invalidServers)
    }
  },
  removeServers: (settings, callback, skipUpdateVIP) => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.vips.removeServers is not supported when config.database.uri is set to a databaseless folder path')) : null
    const servers = settings.serversToRemove
    const success = {}
    const successIds = []
    const failed = []
    for (var x = 0; x < servers.length; ++x) {
      const id = servers[x]
      if (!storage.vipServers[id] && !storage.vipUsers[settings.id].servers.includes(id)) {
        failed.push(id)
        continue
      }
      const index = storage.vipUsers[settings.id].servers.indexOf(id)
      if (index === -1) {
        failed.push(id)
        continue
      }
      success[id] = storage.vipServers[id] ? storage.vipServers[id].name : 'missing name'
      successIds.push(id)
      delete storage.vipServers[id]
      storage.vipUsers[settings.id].servers.splice(index, 1)
      const guildRss = currentGuilds.get(id)
      if (guildRss && guildRss.sources) {
        const rssList = guildRss.sources
        let vipScheduleKeywords
        for (var a = 0; a < storage.scheduleManager.scheduleList.length; ++a) {
          if (storage.scheduleManager.scheduleList[a].schedule.name === 'vip') vipScheduleKeywords = storage.scheduleManager.scheduleList[a].schedule.keywords
        }
        for (var rssName in rssList) {
          vipScheduleKeywords.splice(rssList[rssName].link, 1)
          storage.allScheduleWords.splice(rssList[rssName].link, 1)
          delete storage.scheduleAssigned[rssName]
        }
      }
      if (skipUpdateVIP) exports.vips.uniformize(storage.vipUsers, storage.vipServers)
      else exports.vips.update(storage.vipUsers[settings.id], null, true)
      // No need to call uniformize since exports.vips.update does this
    }
    if (callback) callback(null, success, failed)
    log.general.success(`VIP servers have been successfully removed: ${successIds}.${failed.length > 0 ? ` The following were not removed due to incorrect backing: ${failed}` : ``}`)
  },
  refresh: callback => {
    if (!config.database.uri.startsWith('mongo')) return callback ? callback(new Error('dbOps.vips.refresh is not supported when config.database.uri is set to a databaseless folder path')) : null
    if (!fs.existsSync(path.join(__dirname, '..', 'settings', 'vips.js'))) return callback ? callback(new Error('Missing VIP module')) : null
    require('../settings/vips.js')(storage.bot, callback)
  },
  refreshVipSchedule: () => {
    if (config._vip !== true) return
    const vipLinks = []
    for (var vipId in storage.vipServers) {
      const benefactor = storage.vipServers[vipId].benefactor
      if (benefactor.pledgedAmount < 500 && !benefactor.override) continue
      const guildRss = storage.currentGuilds.get(vipId)
      if (!guildRss) continue
      const rssList = guildRss.sources
      if (!rssList) continue
      for (var rssName in rssList) {
        const link = rssList[rssName].link
        if (link.includes('feed43.com') || storage.scheduleAssigned[rssName] === 'vip') continue
        vipLinks.push(link)
        storage.allScheduleWords.push(link)
        delete storage.scheduleAssigned[rssName]
      }
    }
    if (vipLinks.length > 0) {
      let vipSchedule
      for (var x = 0; x < storage.scheduleManager.scheduleList.length; ++x) {
        if (storage.scheduleManager.scheduleList[x].schedule.name === 'vip') vipSchedule = storage.scheduleManager.scheduleList[x].schedule
      }
      if (!vipSchedule) {
        const newSched = { name: 'vip', refreshTimeMinutes: config._vipRefreshTimeMinutes ? config._vipRefreshTimeMinutes : 10, keywords: vipLinks }
        storage.scheduleManager.addSchedule(newSched)
      } else for (var y = 0; y < vipLinks.length; ++y) vipSchedule.keywords.push(vipLinks[y])
    }
  }
}

exports.general = {
  cleanDatabase: (currentCollections, callback) => { // Remove unused feed collections
    if (!config.database.uri.startsWith('mongo')) return callback ? callback() : null
    if (!Array.isArray(currentCollections)) return callback(new Error('currentCollections is not an Array'))
    mongoose.connection.db.listCollections().toArray((err, names) => {
      if (err) return callback(err)
      let c = 0
      let d = 0
      names.forEach(elem => {
        const name = elem.name
        if (!/\d/.exec(name) || currentCollections.includes(name)) return // Not eligible to be dropped - feed collections all have digits in them
        ++c
        if (config.database.clean !== true) return
        mongoose.connection.db.dropCollection(name, err => {
          if (err) return log.general.error(`Unable to drop unused collection ${name}`, err)
          log.general.info(`Dropped unused feed collection ${name}`)
          if (++d === c) log.general.info('All unused feed collections successfully dropped')
        })
      })
      if (c > 0) log.general.info(config.database.clean === true ? `Number of collections expected to be removed for database cleaning: ${c}` : `Number of unused collections skipping removal due to config.database.clean disabled: ${c}`)
      callback()
    })
  }
}
