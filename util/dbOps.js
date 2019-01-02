const fs = require('fs')
const util = require('util')
const path = require('path')
const mongoose = require('mongoose')
const Discord = require('discord.js')
const storage = require('./storage.js')
const config = require('../config.js')
const LinkTracker = require('../structs/LinkTracker.js')
const models = storage.models
const log = require('./logger.js')
const UPDATE_SETTINGS = { upsert: true, strict: true }
const FAIL_LIMIT = config.feeds.failLimit
const FIND_PROJECTION = '-_id -__v'
const readdirPromise = util.promisify(fs.readdir)
const readFilePromise = util.promisify(fs.readFile)
const writeFilePromise = util.promisify(fs.writeFile)
const mkdirPromise = util.promisify(fs.mkdir)
const unlinkPromise = util.promisify(fs.unlink)
const MONGO_DATABASE = config.database.uri.startsWith('mongo')

exports.guildRss = {
  get: async id => {
    if (MONGO_DATABASE) return models.GuildRss().findOne({ id }, FIND_PROJECTION).lean().exec()
    return JSON.parse(await readFilePromise(path.join(config.database.uri, `${id}.json`)))
  },
  getMany: async ids => {
    if (MONGO_DATABASE) return models.GuildRss().find({ id: { $in: ids } }, FIND_PROJECTION).lean().exec()
    const promises = []
    for (const id of ids) promises.push(exports.guildRss.get(id))
    return Promise.all(promises)
  },
  getAll: async () => {
    // Database version
    if (MONGO_DATABASE) return models.GuildRss().find({}, FIND_PROJECTION).lean().exec()

    // Memory Version
    if (!fs.existsSync(path.join(config.database.uri))) return []
    const fileNames = (await readdirPromise(path.join(config.database.uri))).filter(fileName => /^\d+$/.test(fileName.replace(/\.json/i, '')))
    return new Promise((resolve, reject) => { // Avoid await for the below to allow async reads
      let done = 0
      let read = []
      const total = fileNames.length
      if (total === 0) return resolve([])
      for (var x = 0; x < total; ++x) {
        const name = fileNames[x]
        if (name === 'backup') continue
        readFilePromise(path.join(config.database.uri, name))
          .then(data => {
            try {
              read.push(JSON.parse(data))
            } catch (err) {
              log.general.warning(`Could not parse JSON from source file ${name}`, err)
            }
            if (++done === total) resolve(read)
            console.log(done, total)
          })
          .catch(err => {
            log.general.warning(`Could not read source file ${name}`, err)
            if (++done === total) resolve(read)
            console.log(done, total)
          })
      }
    })
  },
  update: async (guildRss, skipEmptyCheck) => {
    // Memory version
    if (!MONGO_DATABASE) {
      try {
        if (!fs.existsSync(path.join(config.database.uri))) await mkdirPromise(path.join(config.database.uri))
        await writeFilePromise(path.join(config.database.uri, `${guildRss.id}.json`), JSON.stringify(guildRss, null, 2))
      } catch (err) {
        throw err
      }
      if (!skipEmptyCheck) exports.guildRss.empty(guildRss, false)
      return
    }

    // Database version
    const res = await models.GuildRss().updateOne({ id: guildRss.id }, { $set: guildRss }, UPDATE_SETTINGS).exec()
    if (!skipEmptyCheck) exports.guildRss.empty(guildRss, false)
    return res
  },
  remove: async (guildRss, suppressLog) => {
    const guildId = guildRss.id
    if (guildRss && guildRss.sources && Object.keys(guildRss.sources).length > 0) exports.guildRss.backup(guildRss).catch(err => log.general.warning('Unable to backup guild after remvoing', err, true))
    // Memory version
    if (!MONGO_DATABASE) {
      await unlinkPromise(path.join(config.database.uri, `${guildId}.json`))
      const rssList = guildRss ? guildRss.sources : undefined
      if (rssList) {
        for (let rssName in rssList) {
          exports.linkTracker.decrement(rssList[rssName].link, storage.scheduleAssigned[rssName]).catch(err => log.general.warning(`Unable to decrement linkTracker for ${rssList[rssName].link}`, err, true))
        }
      }
      if (!suppressLog) log.general.info(`Deleted guild ${guildId}.json`)
    }
    // Database version
    const rssList = guildRss ? guildRss.sources : undefined
    if (rssList) {
      for (let rssName in rssList) {
        storage.deletedFeeds.push(rssName)
        exports.linkTracker.decrement(rssList[rssName].link, storage.scheduleAssigned[rssName]).catch(err => log.general.warning(`Unable to decrement linkTracker for ${rssList[rssName].link}`, err, true))
      }
    }
    const res = await models.GuildRss().deleteOne({ id: guildId })
    if (!suppressLog) log.general.info(`Removed Guild document ${guildId}`)
    return res
  },
  disableFeed: async (guildRss, rssName) => {
    if (guildRss.sources[rssName].disabled === true) return log.general.warning(`Feed named ${rssName} is already disabled in guild ${guildRss.id}`)
    guildRss.sources[rssName].disabled = true
    await exports.guildRss.update(guildRss)
    log.general.warning(`Feed named ${rssName} (${guildRss.sources[rssName].link}) has been disabled in guild ${guildRss.id}`)
  },
  enableFeed: async (guildRss, rssName) => {
    if (guildRss.sources[rssName].disabled == null) return log.general.info(`Feed named ${rssName} is already enabled in guild ${guildRss.id}`)
    delete guildRss.sources[rssName].disabled
    await exports.guildRss.update(guildRss)
    log.general.info(`Feed named ${rssName} (${guildRss.sources[rssName].link}) has been enabled in guild ${guildRss.id}`)
  },
  removeFeed: async (guildRss, rssName) => {
    const link = guildRss.sources[rssName].link
    delete guildRss.sources[rssName]
    storage.deletedFeeds.push(rssName)
    const res = await exports.guildRss.update(guildRss)
    await exports.linkTracker.decrement(link, storage.scheduleAssigned[rssName])
    return res
  },
  backup: async guildRss => {
    if (!guildRss || exports.guildRss.empty(guildRss, true)) return
    // Memory version
    if (!MONGO_DATABASE) {
      if (!fs.existsSync(path.join(config.database.uri, 'backup'))) {
        await mkdirPromise(path.join(config.database.uri, 'backup'))
      }
      await writeFilePromise(path.join(config.database.uri, 'backup', `${guildRss.id}.json`), JSON.stringify(guildRss, null, 2))
    }
    // Database version
    await models.GuildRssBackup().updateOne({ id: guildRss.id }, { $set: guildRss }, UPDATE_SETTINGS).exec()
  },
  restore: async guildId => {
    // Memory version
    let guildRss
    if (!MONGO_DATABASE) {
      if (!fs.existsSync(path.join(config.database.uri, 'backup', `${guildId}.json`))) return
      try {
        const json = await readFilePromise(path.join(config.database.uri, 'backup', `${guildId}.json`))
        const parsed = JSON.parse(json)
        if (exports.guildRss.empty(parsed, true)) guildRss = parsed
      } catch (err) {
        throw err
      }
    } else {
      // Database version
      guildRss = await models.GuildRssBackup().findOne({ id: guildId }, FIND_PROJECTION).lean().exec()
      if (!guildRss || exports.guildRss.empty(guildRss, true)) return
    }

    await exports.guildRss.update(guildRss)
    const rssList = guildRss.sources
    if (rssList) {
      for (var rssName in rssList) {
        const source = rssList[rssName]
        if (!storage.bot.channels.get(source.channel)) {
          await exports.guildRss.removeFeed(guildRss, rssName)
          log.general.info(`Removed feed ${source.link} due to missing channel ${source.channel}`, storage.bot.guilds.get(guildRss.id))
        } else {
          await exports.linkTracker.increment(source.link)
        }
      }
    }
    await models.GuildRssBackup().deleteOne({ id: guildId })
    return guildRss
  },
  empty: (guildRss, skipRemoval) => { // Used on the beginning of each cycle to check for empty sources per guild
    if (guildRss.sources && Object.keys(guildRss.sources).length > 0) return false
    if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage && !guildRss.prefix && (!guildRss.sendAlertsTo || guildRss.sendAlertsTo.length === 0)) { // Delete only if server-specific special settings are not found
      if (!skipRemoval) {
        exports.guildRss.remove(guildRss)
          .then(() => log.general.info(`(G: ${guildRss.id}) 0 sources found with no custom settings deleted`))
          .catch(err => log.general.error(`(G: ${guildRss.id}) Could not delete guild due to 0 sources`, err))
      }
    } else log.general.info(`(G: ${guildRss.id}) 0 sources found, skipping`)
    return true
  }
}

exports.guildRssBackup = {
  dropIndexes: async () => models.GuildRssBackup().collection.dropIndexes()
}

exports.feeds = {
  dropIndexes: async (link, shardId, scheduleName) => models.Feed(link, shardId, scheduleName).collection.dropIndexes()
}

// linkTracker for determine when to drop collections during bot's lifetime, and for URL resolution
exports.linkTracker = {
  write: async linkTracker => {
    if (!(linkTracker instanceof LinkTracker)) throw new TypeError('linkTracker argument is not instance of LinkTracker')
    if (!MONGO_DATABASE) return
    try {
      await models.LinkTracker().collection.drop().catch(err => {
        if (err.code !== 26) log.general.warning('Unable to drop link tracker collection before insertion', err, true)
      })
      const docs = linkTracker.toDocs()
      if (docs.length > 0) return await models.LinkTracker().collection.insertMany(docs)
    } catch (err) {
      throw err
    }
  },
  get: async () => {
    if (!MONGO_DATABASE) return new LinkTracker()
    const docs = await models.LinkTracker().find({}).lean().exec()
    return new LinkTracker(docs, storage.bot)
  },
  update: async (link, count, scheduleName) => {
    if (!MONGO_DATABASE) return
    const shardId = storage.bot && storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : undefined
    if (count > 0) {
      await models.LinkTracker().updateOne({ link: link, shard: shardId, scheduleName: scheduleName }, { $set: { link: link, count: count, shard: shardId, scheduleName: scheduleName } }, UPDATE_SETTINGS).exec()
    } else {
      try {
        await models.LinkTracker().deleteOne({ link, shard: shardId, scheduleName: scheduleName })
      } catch (err) {
        if (err.code !== 25) throw err // 25 = ns not found - doesn't exist
      }
    }
  },
  decrement: async (link, scheduleName) => {
    if (!MONGO_DATABASE) return
    const linkTracker = await exports.linkTracker.get()
    if (!linkTracker.get(link, scheduleName)) return
    const count = linkTracker.decrement(link, scheduleName)
    if (!count) {
      await exports.failedLinks.reset(link)
      try {
        await models.Feed(link, linkTracker.shardId, scheduleName).collection.drop()
      } catch (err) {
        if (err.code !== 26) throw err
      }
    }
    await exports.linkTracker.update(link, count, scheduleName)
  },
  increment: async (link, scheduleName) => {
    if (!MONGO_DATABASE) return
    const shard = storage.bot && storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : undefined
    await models.LinkTracker().updateOne({ link, shard, scheduleName }, { $inc: { count: 1 } }, UPDATE_SETTINGS).exec()
  }
}

exports.failedLinks = {
  _sendAlert: (link, message, skipProcessSend) => {
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) return process.send({ _drss: true, type: 'failedLinks._sendAlert', link: link, message: message, _loopback: true })
    exports.guildRss.getAll()
      .then(results => {
        results.forEach(guildRss => {
          const rssList = guildRss.sources
          if (!rssList) return
          for (var i in rssList) {
            const source = rssList[i]
            const channel = guildRss.sendAlertsTo || storage.bot.channels.get(source.channel)
            if (source.link === link && channel && config._skipMessages !== true) {
              let sent = false
              if (Array.isArray(channel)) { // Each array item is a user id
                channel.forEach(userId => {
                  const user = storage.bot.users.get(userId)
                  if (user && typeof message === 'string' && message.includes('connection failure limit')) {
                    sent = true
                    user.send(`**ATTENTION** - Feed link <${link}> in channel <#${source.channel}> has reached the connection failure limit in server named \`${guildRss.name}\` with ID \`${guildRss.id}\`, and will not be retried until it is manually refreshed by this server, or another server using this feed. Use \`${guildRss.prefix || config.bot.prefix}rsslist\` in your server for more information.`).catch(err => log.general.warning(`Unable to send limit notice to user ${userId} for feed ${link} (a)`, user, err))
                  } else if (user) {
                    sent = true
                    user.send(message).catch(err => log.general.warning(`Unable to send limit notice to user ${userId} for feed ${link} (b)`, user, err))
                  }
                })
              }
              if (sent === false) {
                const attach = channel.guild.me.permissionsIn(channel).has('ATTACH_FILES')
                const m = attach ? `${message}\n\nA backup for this server at this point in time has been attached in case this feed is subjected to forced removal in the future.` : message
                if (config._skipMessages !== true) channel.send(m, attach ? new Discord.Attachment(Buffer.from(JSON.stringify(guildRss, null, 2)), `${channel.guild.id}.json`) : null).catch(err => log.general.warning(`Unable to send limit notice for feed ${link}`, channel.guild, channel, err))
              }
            }
          }
        })
      })
      .catch(err => log.general.warning(`Failed to query all profiles for _sendAlert for failed link ${link}`, err))
  },
  get: async link => {
    if (!MONGO_DATABASE) return
    return models.FailedLink().findOne({ link }, FIND_PROJECTION).lean().exec()
  },
  getMultiple: async links => {
    if (!MONGO_DATABASE) return []
    return models.FailedLink().find({ link: { $in: links } }, FIND_PROJECTION).lean().exec()
  },
  getAll: async () => {
    if (!MONGO_DATABASE) return []
    return models.FailedLink().find({}, FIND_PROJECTION).lean().exec()
  },
  increment: async link => {
    if (FAIL_LIMIT === 0 || !MONGO_DATABASE) return
    await storage.models.FailedLink().updateOne({ link: link }, { $inc: { count: 1 } }, UPDATE_SETTINGS).exec()
  },
  fail: async link => {
    if (!MONGO_DATABASE) return
    if (config.feeds.failLimit === 0) throw new Error('Unable to fail a link when config.feeds.failLimit is 0')
    const now = new Date().toString()
    if (config.feeds.notifyFail === true) exports.failedLinks._sendAlert(link, `**ATTENTION** - Feed link <${link}> has reached the connection failure limit and will not be retried until it is manually refreshed by this server, or another server using this feed. See \`${config.bot.prefix}rsslist\` for more information.`)
    await storage.models.FailedLink().updateOne({ link: link }, { $set: { link: link, failed: now } }, UPDATE_SETTINGS).exec()
    log.cycle.error(`${link} has been failed and will no longer be retrieved on subsequent retrieval cycles`)
  },
  reset: async link => {
    if (!MONGO_DATABASE) return
    await storage.models.FailedLink().deleteOne({ link: link })
  }
}

exports.blacklists = {
  uniformize: async (blacklistGuilds, blacklistUsers, skipProcessSend) => {
    if (!MONGO_DATABASE) throw new Error('dbOps.blacklists.uniformize not supported when config.database.uri is set to a databaseless folder path')
    if (!skipProcessSend && storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'blacklists.uniformize', blacklistGuilds: blacklistGuilds, blacklistUsers: blacklistUsers, _loopback: true })
    else if (skipProcessSend) {
      storage.blacklistGuilds = blacklistGuilds
      storage.blacklistUsers = blacklistUsers
    }
  },
  getAll: async () => {
    if (!MONGO_DATABASE) return []
    return models.Blacklist().find().lean().exec()
  },
  add: async settings => {
    if (!MONGO_DATABASE) throw new Error('dbOps.blacklists.add is not supported when config.database.uri is set to a databaseless folder path')
    await models.Blacklist().updateOne({ id: settings.id }, { $set: settings }, UPDATE_SETTINGS).exec()
    if (settings.isGuild) storage.blacklistGuilds.push(settings.id)
    else storage.blacklistUsers.push(settings.id)
    await exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
  },
  remove: async id => {
    if (!MONGO_DATABASE) throw new Error('dbOps.blacklists.remove is not supported when config.database.uri is set to a databaseless folder path')
    const doc = await models.Blacklist().deleteOne({ id: id })
    if (storage.blacklistGuilds.includes(id)) storage.blacklistGuilds.splice(storage.blacklistGuilds.indexOf(doc.id), 1)
    else storage.blacklistUsers.splice(storage.blacklistUsers.indexOf(doc.id), 1)
    await exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
  },
  refresh: async () => {
    if (!MONGO_DATABASE) throw new Error('dbOps.blacklists.refresh is not supported when config.database.uri is set to a databaseless folder path')
    const docs = await exports.blacklists.getAll()
    for (var x = 0; x < docs.length; ++x) {
      const doc = docs[x]
      if (doc.isGuild) storage.blacklistGuilds.push(doc.id)
      else storage.blacklistUsers.push(doc.id)
    }
    await exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
  }
}

exports.statistics = {
  clear: async () => {
    if (!MONGO_DATABASE) return
    return models.Statistics().collection.drop()
  },
  get: async (shard = 0) => {
    if (!MONGO_DATABASE) return
    return models.Statistics().findOne({ shard }, FIND_PROJECTION).lean().exec()
  },
  getAll: async () => {
    if (!MONGO_DATABASE) return []
    return models.Statistics().find({}, FIND_PROJECTION).lean().exec()
  },
  update: async data => {
    if (!MONGO_DATABASE) return
    const shard = data.shard || 0
    const shardStats = await exports.statistics.get(shard)
    if (!shardStats) return models.Statistics().updateOne({ shard }, { $set: data }, UPDATE_SETTINGS).exec()
    data.cycleTime = (shardStats.cycleTime + data.cycleTime) / 2
    data.cycleFails = (shardStats.cycleFails + data.cycleFails) / 2
    data.cycleLinks = (shardStats.cycleLinks + data.cycleLinks) / 2
    data.feeds = (shardStats.feeds + data.feeds) / 2
    return models.Statistics().updateOne({ shard }, { $set: data }, UPDATE_SETTINGS).exec()
  }
}

exports.vips = {
  get: id => models.VIP().findOne({ id }, FIND_PROJECTION).lean().exec(),
  getAll: async () => {
    if (!MONGO_DATABASE) return []
    return models.VIP().find({}, FIND_PROJECTION).lean().exec()
  },
  update: async settings => {
    if (!MONGO_DATABASE) throw new Error('dbOps.vips.update is not supported when config.database.uri is set to a databaseless folder path')
    if (!settings.name) {
      const dUser = storage.bot.users.get(settings.id)
      settings.name = dUser ? dUser.username : null
    }
    await models.VIP().updateOne({ id: settings.id }, { $set: settings }, UPDATE_SETTINGS).exec()
    log.general.success(`Updated VIP ${settings.id} (${settings.name})`)
  },
  updateBulk: async vipUsers => {
    if (!MONGO_DATABASE) throw new Error('dbOps.vips.updateBulk is not supported when config.database.uri is set to a databaseless folder path')
    let complete = 0
    const total = Object.keys(vipUsers).length
    let errored = false
    for (var e in vipUsers) {
      const vipUser = vipUsers[e]
      if (!vipUser.name) {
        const dUser = storage.bot.users.get(vipUser.id)
        vipUser.name = dUser ? dUser.username : null
      }
    }

    if (Object.keys(vipUsers).length === 0) return
    return new Promise((resolve, reject) => {
      for (var q in vipUsers) {
        const vipUser = vipUsers[q]
        models.VIP().updateOne({ id: vipUser.id }, { $set: JSON.parse(JSON.stringify(vipUser)) }, UPDATE_SETTINGS).exec()
          .then(() => {
            log.general.success(`Bulk updated VIP ${vipUser.id} (${vipUser.name})`)
            if (++complete === total) return errored ? reject(new Error('Errors encountered with vips.updateBulk logged')) : resolve()
          })
          .catch(err => { // stringify and parse to prevent mongoose from modifying my object
            log.general.error(`Unable to add VIP for id ${vipUser.id}`, err, true)
            errored = true
            if (++complete === total) return errored ? reject(new Error('Errors encountered with vips.updateBulk logged')) : resolve()
          })
      }
    })
  },
  remove: async id => {
    if (!MONGO_DATABASE) throw new Error('dbOps.vips.remove is not supported when config.database.uri is set to a databaseless folder path')
    await models.VIP().deleteOne({ id: id }).exec()
  },
  addServers: async settings => {
    if (!MONGO_DATABASE) throw new Error('dbOps.vips.addServers is not supported when config.database.uri is set to a databaseless folder path')
    const { serversToAdd, vipUser } = settings
    if (serversToAdd.length === 0) return
    for (const id of serversToAdd) {
      if (vipUser.servers.includes(id)) throw new Error(`Server ${id} already exists`)
      vipUser.servers.push(id)
      log.general.success(`VIP servers added for VIP ${vipUser.id} (${vipUser.name}): ${serversToAdd.join(',')}`)
    }
    await models.VIP().updateOne({ id: vipUser.id }, { $addToSet: { servers: { $each: serversToAdd } } }, UPDATE_SETTINGS).exec()
  },
  removeServers: async settings => {
    if (!MONGO_DATABASE) throw new Error('dbOps.vips.removeServers is not supported when config.database.uri is set to a databaseless folder path')
    const { serversToRemove, vipUser } = settings
    for (const id of serversToRemove) {
      const index = vipUser.servers.indexOf(id)
      if (index === -1) throw new Error(`Server ID ${id} not found`)
      vipUser.servers.splice(index, 1)
      const guildRss = await exports.guildRss.get(id)
      if (guildRss && guildRss.sources) {
        const rssList = guildRss.sources
        let vipScheduleRssNames
        for (var feedSchedule of storage.scheduleManager.scheduleList) {
          if (feedSchedule.name === 'vip') vipScheduleRssNames = feedSchedule.rssNames
        }
        if (vipScheduleRssNames) {
          for (var rssName in rssList) {
            vipScheduleRssNames.splice(rssName, 1)
            storage.allScheduleRssNames.splice(rssName, 1)
            delete storage.scheduleAssigned[rssName]
          }
        }
      }
      await models.VIP().updateOne({ id: vipUser.id }, { $pull: { servers: { $in: serversToRemove } } }, UPDATE_SETTINGS).exec()
    }
    log.general.success(`VIP servers removed from VIP ${vipUser.id} (${vipUser.name}): ${serversToRemove.join(',')}`)
  },
  refresh: async () => {
    if (!config._vip) return
    if (!MONGO_DATABASE) throw new Error('dbOps.vips.refresh is not supported when config.database.uri is set to a databaseless folder path')
    if (!fs.existsSync(path.join(__dirname, '..', 'settings', 'vips.js'))) throw new Error('Missing VIP module')
    return require('../settings/vips.js')(storage.bot)
  }
}

exports.general = {
  cleanDatabase: async currentCollections => { // Remove unused feed collections
    if (!MONGO_DATABASE) return
    if (!Array.isArray(currentCollections)) throw new Error('currentCollections is not an Array')
    const names = await mongoose.connection.db.listCollections().toArray()
    let c = 0
    let d = 0
    names.forEach(elem => {
      const name = elem.name
      if (!/\d/.exec(name) || currentCollections.includes(name)) return // Not eligible to be dropped - feed collections all have digits in them
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
}
