const fs = require('fs')
const util = require('util')
const path = require('path')
const mongoose = require('mongoose')
const Discord = require('discord.js')
const storage = require('./storage.js')
const config = require('../config.js')
const redisOps = require('./redisOps.js')
const LinkTracker = require('../structs/LinkTracker.js')
const models = storage.models
const log = require('./logger.js')
const UPDATE_SETTINGS = { upsert: true, strict: true }
const FAIL_LIMIT = config.feeds.failLimit
const FIND_PROJECTION = '-_id -__v'
const assignedSchedules = require('./assignedSchedules.js')
const readdirPromise = util.promisify(fs.readdir)
const readFilePromise = util.promisify(fs.readFile)
const writeFilePromise = util.promisify(fs.writeFile)
const mkdirPromise = util.promisify(fs.mkdir)
const unlinkPromise = util.promisify(fs.unlink)

exports.guildRss = {
  get: async id => {
    if (config.database.uri.startsWith('mongo')) return models.GuildRss().findOne({ id }, FIND_PROJECTION).lean().exec()
    const filePath = path.join(config.database.uri, `${id}.json`)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(await readFilePromise(filePath))
  },
  getMany: async ids => {
    if (config.database.uri.startsWith('mongo')) return models.GuildRss().find({ id: { $in: ids } }, FIND_PROJECTION).lean().exec()
    const promises = []
    for (const id of ids) promises.push(exports.guildRss.get(id))
    return Promise.all(promises)
  },
  getAll: async () => {
    // Database version
    if (config.database.uri.startsWith('mongo')) return models.GuildRss().find({}, FIND_PROJECTION).lean().exec()

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
          })
          .catch(err => {
            log.general.warning(`Could not read source file ${name}`, err)
            if (++done === total) resolve(read)
          })
      }
    })
  },
  update: async guildRss => {
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
      try {
        if (!fs.existsSync(path.join(config.database.uri))) await mkdirPromise(path.join(config.database.uri))
        await writeFilePromise(path.join(config.database.uri, `${guildRss.id}.json`), JSON.stringify(guildRss, null, 2))
      } catch (err) {
        throw err
      }
      return redisOps.events.emitUpdatedProfile(guildRss.id)
    }

    // Database version
    // for (const key in guildRss) {
    //   const val = guildRss[key]
    //   if (!val) delete guildRss[key]
    //   else if (Array.isArray(val) && val.length === 0) delete guildRss[key]
    //   else if (typeof val === 'object' && val !== null && Object.keys(val).length === 0) delete guildRss[key]
    // }
    const res = await models.GuildRss().replaceOne({ id: guildRss.id }, guildRss, UPDATE_SETTINGS).exec()
    redisOps.events.emitUpdatedProfile(guildRss.id)
    return res
  },
  remove: async (guildRss, suppressLog) => {
    const guildId = guildRss.id
    if (guildRss && guildRss.sources && Object.keys(guildRss.sources).length > 0) exports.guildRss.backup(guildRss).catch(err => log.general.warning('Unable to backup guild after remvoing', err, true))
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
      const filePath = path.join(config.database.uri, `${guildId}.json`)
      if (fs.existsSync(filePath)) await unlinkPromise(filePath)
      return log.general.info(`Deleted guild ${guildId}.json`)
    }
    // Database version
    const rssList = guildRss ? guildRss.sources : undefined
    if (rssList) {
      for (let rssName in rssList) {
        storage.deletedFeeds.push(rssName)
        exports.linkTracker.decrement(rssList[rssName].link, assignedSchedules.getScheduleName(rssName)).catch(err => log.general.warning(`Unable to decrement linkTracker for ${rssList[rssName].link}`, err, true))
      }
    }
    const res = await models.GuildRss().deleteOne({ id: guildId })
    if (!suppressLog) log.general.info(`Removed Guild document ${guildId}`)
    return res
  },
  disableFeed: async (guildRss, rssName, reason) => {
    if (guildRss.sources[rssName].disabled) return log.general.warning(`Feed named ${rssName} is already disabled in guild ${guildRss.id}`)
    guildRss.sources[rssName].disabled = reason || 'No reason available'
    await exports.guildRss.update(guildRss)
    log.general.warning(`Feed named ${rssName} (${guildRss.sources[rssName].link}) has been disabled in guild ${guildRss.id} (Reason: ${reason})`)
  },
  enableFeed: async (guildRss, rssName, reason) => {
    if (!guildRss.sources[rssName].disabled) return log.general.info(`Feed named ${rssName} is already enabled in guild ${guildRss.id}`)
    delete guildRss.sources[rssName].disabled
    await exports.guildRss.update(guildRss)
    log.general.info(`Feed named ${rssName} (${guildRss.sources[rssName].link}) has been enabled in guild ${guildRss.id} (Reason: ${reason})`)
  },
  removeFeed: async (guildRss, rssName) => {
    const link = guildRss.sources[rssName].link
    delete guildRss.sources[rssName]
    storage.deletedFeeds.push(rssName)
    const res = await exports.guildRss.update(guildRss)
    await exports.linkTracker.decrement(link, assignedSchedules.getScheduleName(rssName))
    return res
  },
  backup: async guildRss => {
    if (!guildRss || exports.guildRss.empty(guildRss, true)) return
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
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
    const backupPath = path.join(config.database.uri, 'backup', `${guildId}.json`)
    if (!config.database.uri.startsWith('mongo')) {
      if (!fs.existsSync(backupPath)) return
      try {
        const json = await readFilePromise(backupPath)
        const parsed = JSON.parse(json)
        guildRss = parsed
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
    if (config.database.uri.startsWith('mongo')) {
      await models.GuildRssBackup().deleteOne({ id: guildId })
    } else {
      fs.unlinkSync(backupPath)
    }
    return guildRss
  },
  empty: (guildRss, skipRemoval) => { // Used on the beginning of each cycle to check for empty sources per guild
    if (guildRss.sources && Object.keys(guildRss.sources).length > 0) return false
    if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage && !guildRss.prefix && (!guildRss.sendAlertsTo || guildRss.sendAlertsTo.length === 0)) { // Delete only if server-specific special settings are not found
      if (!skipRemoval) {
        exports.guildRss.remove(guildRss, true)
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
    if (!config.database.uri.startsWith('mongo')) return
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
    if (!config.database.uri.startsWith('mongo')) return new LinkTracker()
    const docs = await models.LinkTracker().find({}).lean().exec()
    return new LinkTracker(docs, storage.bot)
  },
  update: async (link, count, scheduleName) => {
    if (!config.database.uri.startsWith('mongo')) return
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
    if (!config.database.uri.startsWith('mongo')) return
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
    if (!config.database.uri.startsWith('mongo')) return
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
            if (source.link !== link || config._skipMessages === true) continue
            let sent = false
            if (Array.isArray(guildRss.sendAlertsTo)) { // Each array item is a user id
              const userIds = guildRss.sendAlertsTo
              userIds.forEach(userId => {
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
              const channel = storage.bot.channels.get(source.channel)
              if (channel) { // The channel may not exist since this function is broadcasted to all shards
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
    if (!config.database.uri.startsWith('mongo')) return
    return models.FailedLink().findOne({ link }, FIND_PROJECTION).lean().exec()
  },
  getMultiple: async links => {
    if (!config.database.uri.startsWith('mongo')) return []
    return models.FailedLink().find({ link: { $in: links } }, FIND_PROJECTION).lean().exec()
  },
  getAll: async () => {
    if (!config.database.uri.startsWith('mongo')) return []
    return models.FailedLink().find({}, FIND_PROJECTION).lean().exec()
  },
  increment: async link => {
    if (FAIL_LIMIT === 0 || !config.database.uri.startsWith('mongo')) return
    await storage.models.FailedLink().updateOne({ link: link }, { $inc: { count: 1 } }, UPDATE_SETTINGS).exec()
  },
  fail: async link => {
    if (!config.database.uri.startsWith('mongo')) return
    if (config.feeds.failLimit === 0) throw new Error('Unable to fail a link when config.feeds.failLimit is 0')
    const now = new Date().toString()
    if (config.feeds.notifyFail === true) exports.failedLinks._sendAlert(link, `**ATTENTION** - Feed link <${link}> has reached the connection failure limit and will not be retried until it is manually refreshed by this server, or another server using this feed. See \`${config.bot.prefix}rsslist\` for more information.`)
    await storage.models.FailedLink().updateOne({ link: link }, { $set: { link: link, failed: now } }, UPDATE_SETTINGS).exec()
    log.cycle.error(`${link} has been failed and will no longer be retrieved on subsequent retrieval cycles`)
  },
  reset: async link => {
    if (!config.database.uri.startsWith('mongo')) return
    await storage.models.FailedLink().deleteOne({ link: link })
  }
}

exports.blacklists = {
  uniformize: async (blacklistGuilds, blacklistUsers, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.uniformize not supported when config.database.uri is set to a databaseless folder path')
    if (!skipProcessSend && storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'blacklists.uniformize', blacklistGuilds: blacklistGuilds, blacklistUsers: blacklistUsers, _loopback: true })
    else if (skipProcessSend) {
      storage.blacklistGuilds = blacklistGuilds
      storage.blacklistUsers = blacklistUsers
    }
  },
  getAll: async () => {
    if (!config.database.uri.startsWith('mongo')) return []
    return models.Blacklist().find().lean().exec()
  },
  add: async settings => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.add is not supported when config.database.uri is set to a databaseless folder path')
    await models.Blacklist().updateOne({ id: settings.id }, { $set: settings }, UPDATE_SETTINGS).exec()
    if (settings.isGuild) storage.blacklistGuilds.push(settings.id)
    else storage.blacklistUsers.push(settings.id)
    await exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
  },
  remove: async id => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.remove is not supported when config.database.uri is set to a databaseless folder path')
    const doc = await models.Blacklist().deleteOne({ id: id })
    if (storage.blacklistGuilds.includes(id)) storage.blacklistGuilds.splice(storage.blacklistGuilds.indexOf(doc.id), 1)
    else storage.blacklistUsers.splice(storage.blacklistUsers.indexOf(doc.id), 1)
    await exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
  },
  refresh: async () => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.refresh is not supported when config.database.uri is set to a databaseless folder path')
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
    if (!config.database.uri.startsWith('mongo')) return
    return models.Statistics().collection.drop()
  },
  get: async (shard = 0) => {
    if (!config.database.uri.startsWith('mongo')) return
    return models.Statistics().findOne({ shard }, FIND_PROJECTION).lean().exec()
  },
  getAll: async () => {
    if (!config.database.uri.startsWith('mongo')) return []
    return models.Statistics().find({}, FIND_PROJECTION).lean().exec()
  },
  update: async data => {
    if (!config.database.uri.startsWith('mongo')) return
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
    if (!config.database.uri.startsWith('mongo')) return []
    return models.VIP().find({}, FIND_PROJECTION).lean().exec()
  },
  update: async settings => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.update is not supported when config.database.uri is set to a databaseless folder path')
    if (!settings.name) {
      const dUser = storage.bot.users.get(settings.id)
      settings.name = dUser ? dUser.username : null
    }
    await models.VIP().updateOne({ id: settings.id }, { $set: settings }, UPDATE_SETTINGS).exec()
    log.general.success(`Updated VIP ${settings.id} (${settings.name})`)
  },
  updateBulk: async vipUsers => {
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
        models.VIP().updateOne({ id: vipUser.id }, { $set: vipUser, ...unsets }, UPDATE_SETTINGS).exec()
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
  },
  remove: async id => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.remove is not supported when config.database.uri is set to a databaseless folder path')
    await models.VIP().deleteOne({ id: id }).exec()
  },
  addServers: async settings => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.addServers is not supported when config.database.uri is set to a databaseless folder path')
    const { serversToAdd, vipUser } = settings
    if (serversToAdd.length === 0) return
    for (const id of serversToAdd) {
      if (vipUser.servers.includes(id)) throw new Error(`Server ${id} already exists`)
      vipUser.servers.push(id)
      const guildRss = await exports.guildRss.get(id)
      if (guildRss) {
        const rssList = guildRss.sources
        if (rssList) {
          for (const rssName in rssList) {
            assignedSchedules.clearScheduleName(rssName)
          }
        }
      }
      log.general.success(`VIP servers added for VIP ${vipUser.id} (${vipUser.name}): ${serversToAdd.join(',')}`)
    }
    await models.VIP().updateOne({ id: vipUser.id }, { $addToSet: { servers: { $each: serversToAdd } } }, UPDATE_SETTINGS).exec()
  },
  removeServers: async settings => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.removeServers is not supported when config.database.uri is set to a databaseless folder path')
    const { serversToRemove, vipUser } = settings
    for (const id of serversToRemove) {
      const index = vipUser.servers.indexOf(id)
      if (index === -1) throw new Error(`Server ID ${id} not found`)
      vipUser.servers.splice(index, 1)
      const guildRss = await exports.guildRss.get(id)
      if (guildRss && guildRss.sources) {
        const rssList = guildRss.sources
        for (var rssName in rssList) {
          assignedSchedules.clearScheduleName(rssName)
        }
      }
      await models.VIP().updateOne({ id: vipUser.id }, { $pull: { servers: { $in: serversToRemove } } }, UPDATE_SETTINGS).exec()
    }
    log.general.success(`VIP servers removed from VIP ${vipUser.id} (${vipUser.name}): ${serversToRemove.join(',')}`)
  },
  refresh: async (updateNamesFromRedis, vipApiData) => {
    if (!config._vip) return
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.refresh is not supported when config.database.uri is set to a databaseless folder path')
    if (!fs.existsSync(path.join(__dirname, '..', 'settings', 'vips.js'))) throw new Error('Missing VIP module')
    return require('../settings/vips.js')(storage.bot, vipApiData || await require('../settings/api.js')(), updateNamesFromRedis)
  },
  isVipServer: async serverId => {
    if (!config._vip) return true
    const vipUser = (await exports.vips.getAll()).filter(vipUser => vipUser.servers.includes(serverId) && vipUser.invalid !== true)[0]
    return !!vipUser
  }
}

exports.general = {
  addFeedback: async (user, content, type = 'general') => {
    return models.Feedback().create({
      type,
      userId: user.id,
      username: user.username,
      content: content
    })
  },
  addRating: async (user, rating, type = 'general') => {
    return models.Rating().create({
      type,
      userId: user.id,
      username: user.username,
      rating
    })
  },
  cleanDatabase: async currentCollections => { // Remove unused feed collections
    if (!config.database.uri.startsWith('mongo')) return
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
