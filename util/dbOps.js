const fs = require('fs')
const util = require('util')
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

const readdirPromise = util.promisify(fs.readdir)
const readFilePromise = util.promisify(fs.readFile)
const writeFilePromise = util.promisify(fs.writeFile)
const mkdirPromise = util.promisify(fs.mkdir)
const unlinkPromise = util.promisify(fs.unlink)

exports.guildRss = {
  getAll: async () => {
    // Database version
    if (config.database.uri.startsWith('mongo')) return models.GuildRss().find().lean().exec()

    // Memory Version
    if (!fs.existsSync(path.join(config.database.uri))) return []
    const fileNames = await readdirPromise(path.join(config.database.uri))
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
            console.log(done)
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
  update: async (guildRss, skipProcessSend) => {
    if (storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      return process.send({ _drss: true, type: 'guildRss.update', guildRss: guildRss, _loopback: true })
    }
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
      try {
        if (!fs.existsSync(path.join(config.database.uri))) await mkdirPromise(path.join(config.database.uri))
        await writeFilePromise(path.join(config.database.uri, `${guildRss.id}.json`), JSON.stringify(guildRss, null, 2))
      } catch (err) {
        throw err
      }
      currentGuilds.set(guildRss.id, guildRss)
      exports.guildRss.empty(guildRss, false, skipProcessSend)
      return
    }
    // Database version
    await models.GuildRss().update({ id: guildRss.id }, guildRss, UPDATE_SETTINGS).exec()
    currentGuilds.set(guildRss.id, guildRss)
    exports.guildRss.empty(guildRss, false, skipProcessSend)
  },
  remove: async (guildRss, skipProcessSend) => {
    const guildId = guildRss.id
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      return process.send({ _drss: true, type: 'guildRss.remove', guildRss: guildRss, _loopback: true })
    }
    if (guildRss && guildRss.sources && Object.keys(guildRss.sources).length > 0) exports.guildRss.backup(guildRss).catch(err => log.general.warning('Unable to backup guild after remvoing', err))
    // Memory version
    if (!config.database.uri.startsWith('mongo')) {
      await unlinkPromise(path.join(config.database.uri, `${guildId}.json`))
      const rssList = guildRss ? guildRss.sources : undefined
      if (rssList) {
        for (let rssName in rssList) {
          exports.linkTracker.decrement(rssList[rssName].link).catch(err => log.general.warning(`Unable to decrement linkTracker for ${rssList[rssName].link}`, err))
        }
      }
      currentGuilds.delete(guildId)
      return log.general.info(`Deleted guild ${guildId}.json`)
    }
    // Database version
    await models.GuildRss().find({ id: guildId }).remove()
    const rssList = guildRss ? guildRss.sources : undefined
    if (rssList) {
      for (let rssName in rssList) {
        storage.deletedFeeds.push(rssName)
        exports.linkTracker.decrement(rssList[rssName].link).catch(err => log.general.warning(`Unable to decrement linkTracker for ${rssList[rssName].link}`, err))
      }
    }
    currentGuilds.delete(guildId)
    return log.general.info(`Removed Guild document ${guildId}`)
  },
  disableFeed: async (guildRss, rssName, skipProcessSend) => {
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      return process.send({ _drss: true, type: 'guildRss.disableFeed', guildRss: guildRss, rssName: rssName, _loopback: true })
    }
    if (guildRss.sources[rssName].disabled === true) return log.general.warning(`Feed named ${rssName} is already disabled in guild ${guildRss.id}`)
    guildRss.sources[rssName].disabled = true
    await exports.guildRss.update(guildRss)
    log.general.warning(`Feed named ${rssName} (${guildRss.sources[rssName].link}) has been disabled in guild ${guildRss.id}`)
  },
  enableFeed: async (guildRss, rssName, skipProcessSend) => {
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      return process.send({ _drss: true, type: 'guildRss.enableFeed', guildRss: guildRss, rssName: rssName, _loopback: true })
    }
    if (guildRss.sources[rssName].disabled == null) return log.general.info(`Feed named ${rssName} is already enabled in guild ${guildRss.id}`)
    delete guildRss.sources[rssName].disabled
    await exports.guildRss.update(guildRss)
    log.general.info(`Feed named ${rssName} (${guildRss.sources[rssName].link}) has been enabled in guild ${guildRss.id}`)
  },
  removeFeed: async (guildRss, rssName, skipProcessSend) => {
    const link = guildRss.sources[rssName].link
    if (storage.bot && storage.bot.shard && storage.bot.shard.count > 0 && !skipProcessSend) {
      return process.send({ _drss: true, type: 'guildRss.removeFeed', guildRss: guildRss, rssName: rssName, _loopback: true })
    }
    delete guildRss.sources[rssName]
    storage.deletedFeeds.push(rssName)
    await exports.guildRss.update(guildRss)
    await exports.linkTracker.decrement(link)
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
    await models.GuildRssBackup().update({ id: guildRss.id }, guildRss, UPDATE_SETTINGS).exec()
  },
  restore: async (guildId, skipProcessSend) => {
    // Memory version
    let guildRss
    if (!config.database.uri.startsWith('mongo')) {
      if (!fs.existsSync(path.join(config.database.uri, 'backup', `${guildId}.json`))) return
      try {
        const json = await readFilePromise(path.join(config.database.uri, 'backup', `${guildId}.json`))
        const parsed = JSON.parse(json)
        if (exports.guildRss.empty(parsed, true)) guildRss = parsed
      } catch (err) {
        throw err
      }
    }
    // Database version
    const docs = await models.GuildRssBackup().find({ id: guildId }).lean().exec()
    if (docs.length === 0 || exports.guildRss.empty(docs[0], true)) return
    guildRss = docs[0]

    await exports.guildRss.update(guildRss, skipProcessSend)
    const rssList = guildRss.sources
    if (rssList) {
      for (var rssName in rssList) {
        const source = rssList[rssName]
        if (!storage.bot.channels.get(source.channel)) {
          await exports.guildRss.removeFeed(guildRss, rssName, skipProcessSend)
          log.general.info(`Removed feed ${source.link} due to missing channel ${source.channel}`, storage.bot.guilds.get(guildRss.id))
        } else {
          await exports.linkTracker.increment(source.link)
        }
      }
    }
    await models.GuildRssBackup().find({ id: guildId }).remove()
    return guildRss
  },
  empty: (guildRss, skipRemoval, skipProcessSend) => { // Used on the beginning of each cycle to check for empty sources per guild
    if (guildRss.sources && Object.keys(guildRss.sources).length > 0) return false
    if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage) { // Delete only if server-specific special settings are not found
      if (!skipRemoval) {
        exports.guildRss.remove(guildRss, skipProcessSend)
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
  dropIndexes: async (link, shardId) => models.Feed(link, shardId).collection.dropIndexes()
}

exports.linkTracker = {
  write: async linkTracker => {
    if (!(linkTracker instanceof LinkTracker)) throw new TypeError('linkTracker argument is not instance of LinkTracker')
    if (!config.database.uri.startsWith('mongo')) return
    try {
      await models.LinkTracker().collection.drop().catch(err => {
        if (err.code !== 26) log.general.warning('Unable to drop link tracker collection before insertion', err)
      })
      const docs = linkTracker.toDocs()
      if (docs.length > 0) return await models.LinkTracker().collection.insert(docs)
    } catch (err) {
      throw err
    }
  },
  get: async () => {
    if (!config.database.uri.startsWith('mongo')) return new LinkTracker()
    const docs = await models.LinkTracker().find({}).lean().exec()
    return new LinkTracker(docs, storage.bot)
  },
  update: async (link, count) => {
    if (!config.database.uri.startsWith('mongo')) return
    const shardId = storage.bot && storage.bot.shard && storage.bot.shard.count > 0 ? storage.bot.shard.id : undefined
    if (count > 0) await models.LinkTracker().update({ link: link, shard: shardId }, { link: link, count: count, shard: shardId }, UPDATE_SETTINGS).exec()
    else {
      try {
        await models.LinkTracker().find({ link, shard: shardId }).remove()
      } catch (err) {
        if (err.code !== 25) throw err
      }
    }
  },
  decrement: async link => {
    if (!config.database.uri.startsWith('mongo')) return
    const linkTracker = await exports.linkTracker.get()
    if (!linkTracker.get(link)) return
    if (!linkTracker.decrement(link)) {
      await exports.failedLinks.reset(link)
      try {
        await models.Feed(link, linkTracker.shardId).collection.drop()
      } catch (err) {
        if (err.code !== 26) throw err
      }
    }
    await exports.linkTracker.update(link, linkTracker.get(link))
  },
  increment: async link => {
    if (!config.database.uri.startsWith('mongo')) return
    const linkTracker = await exports.linkTracker.get()
    linkTracker.increment(link)
    await exports.linkTracker.update(link, linkTracker.get(link))
  }
}

exports.failedLinks = {
  uniformize: async (failedLinks, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return
    if (!skipProcessSend && storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'failedLinks.uniformize', failedLinks: failedLinks, _loopback: true })
    else if (skipProcessSend) storage.failedLinks = failedLinks // skipProcessSend indicates that this method was called on another shard, otherwise it was already updated in the methods below
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
  initialize: async skipProcessSend => {
    if (!config.database.uri.startsWith('mongo')) return
    const docs = await models.FailedLink().find({}).lean().exec()
    const temp = {}
    for (var i = 0; i < docs.length; ++i) temp[docs[i].link] = docs[i].failed || docs[i].count
    storage.failedLinks = temp
    await exports.failedLinks.uniformize(storage.failedLinks, skipProcessSend)
  },
  increment: async (link, skipProcessSend) => {
    if (FAIL_LIMIT === 0 || !config.database.uri.startsWith('mongo')) return
    if (typeof storage.failedLinks[link] === 'string') return
    storage.failedLinks[link] = storage.failedLinks[link] == null ? 1 : storage.failedLinks[link] + 1
    if (storage.failedLinks[link] >= FAIL_LIMIT) {
      await exports.failedLinks.fail(link)
      log.cycle.error(`${link} has passed the fail limit (${FAIL_LIMIT}). Will no longer retrieve.`)
      if (config.feeds.notifyFail === true) exports.failedLinks._sendAlert(link, `**ATTENTION** - Feed link <${link}> has reached the connection failure limit and will not be retried until it is manually refreshed by this server, or another server using this feed. See \`${config.bot.prefix}rsslist\` for more information.`)
    } else {
      await storage.models.FailedLink().update({ link: link }, { link: link, count: storage.failedLinks[link] }, UPDATE_SETTINGS).exec()
    }
    await exports.failedLinks.uniformize(storage.failedLinks, skipProcessSend)
  },
  fail: async (link, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return
    const now = new Date().toString()
    storage.failedLinks[link] = now
    await storage.models.FailedLink().update({ link: link }, { link: link, failed: now }, UPDATE_SETTINGS).exec()
    await exports.failedLinks.uniformize(storage.failedLinks, skipProcessSend)
  },
  reset: async (link, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) return
    if (storage.failedLinks[link] == null) return
    delete storage.failedLinks[link]
    await storage.models.FailedLink().find({ link: link }).remove()
    await exports.failedLinks.uniformize(storage.failedLinks, skipProcessSend)
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
  get: async () => {
    if (!config.database.uri.startsWith('mongo')) return []
    return models.Blacklist().find().lean().exec()
  },
  add: async settings => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.add is not supported when config.database.uri is set to a databaseless folder path')
    await models.Blacklist().update({ id: settings.id }, settings, UPDATE_SETTINGS).exec()
    if (settings.isGuild) storage.blacklistGuilds.push(settings.id)
    else storage.blacklistUsers.push(settings.id)
    await exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
  },
  remove: async id => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.remove is not supported when config.database.uri is set to a databaseless folder path')
    const doc = await models.Blacklist().find({ id: id }).remove()
    if (storage.blacklistGuilds.includes(id)) storage.blacklistGuilds.splice(storage.blacklistGuilds.indexOf(doc.id), 1)
    else storage.blacklistUsers.splice(storage.blacklistUsers.indexOf(doc.id), 1)
    await exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
  },
  refresh: async () => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.blacklists.refresh is not supported when config.database.uri is set to a databaseless folder path')
    const docs = await exports.blacklists.get()
    for (var x = 0; x < docs.length; ++x) {
      const doc = docs[x]
      if (doc.isGuild) storage.blacklistGuilds.push(doc.id)
      else storage.blacklistUsers.push(doc.id)
    }
    await exports.blacklists.uniformize(storage.blacklistGuilds, storage.blacklistUsers)
  }
}

exports.vips = {
  uniformize: async (vipUsers, vipServers, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.uniformize is not supported when config.database.uri is set to a databaseless folder path')
    if (!skipProcessSend && storage.bot.shard && storage.bot.shard.count > 0) process.send({ _drss: true, type: 'vips.uniformize', vipUsers: vipUsers, vipServers: vipServers, _loopback: true })
    else if (skipProcessSend) {
      storage.vipUsers = vipUsers
      storage.vipServers = vipServers
    }
  },
  get: async () => {
    if (!config.database.uri.startsWith('mongo')) return []
    return models.VIP().find({}).lean().exec()
  },
  update: async (settings, skipAddServers) => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.update is not supported when config.database.uri is set to a databaseless folder path')
    const servers = settings.servers
    storage.vipUsers[settings.id] = settings
    if (servers && !skipAddServers) await exports.vips.addServers({ ...settings, serversToAdd: servers }, true)
    await exports.vips.uniformize(storage.vipUsers, storage.vipServers)
    if (!settings.name) {
      const dUser = storage.bot.users.get(settings.id)
      settings.name = dUser ? dUser.username : null
    }
    delete settings.__v // Deleting this automatically solves an annoying error "Updating the path '__v' would create a conflict at '__v'"
    await models.VIP().update({ id: settings.id }, settings, { upsert: true, strict: true }).exec()
    log.general.success(`Updated VIP ${settings.id} (${settings.name})`)
  },
  updateBulk: async settingsMultiple => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.updateBulk is not supported when config.database.uri is set to a databaseless folder path')
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
    await exports.vips.uniformize(storage.vipUsers, storage.vipServers)

    if (Object.keys(settingsMultiple).length === 0) return
    return new Promise((resolve, reject) => {
      for (var q in settingsMultiple) {
        const settings = settingsMultiple[q]
        const servers = settings.servers || []
        exports.vips.addServers({ ...settings, serversToAdd: servers }, true).then(() => models.VIP().update({ id: settings.id }, JSON.parse(JSON.stringify(settings)), { upsert: true, strict: true }).exec())
          .then(() => {
            log.general.success(`Bulk updated VIP ${settings.id} (${settings.name})`)
            if (++complete === total) return errored ? reject(new Error('Errors encountered with vips.updateBulk logged')) : resolve()
          })
          .catch(err => { // stringify and parse to prevent mongoose from modifying my object
            log.general.error(`Unable to add VIP for id ${settings.id}`, err)
            errored = true
            if (++complete === total) return errored ? reject(new Error('Errors encountered with vips.updateBulk logged')) : resolve()
          })
      }
    })
  },
  remove: async (id, skipProcessSend) => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.remove is not supported when config.database.uri is set to a databaseless folder path')
    const doc = await models.VIP().find({ id: id }).remove()
    const settings = { ...storage.vipUsers[id] }
    delete storage.vipUsers[id]
    const servers = doc.servers
    if (servers) await exports.vips.removeServers({ ...settings, serversToRemove: servers }, skipProcessSend)
  },
  addServers: async (settings, skipUpdateVIP) => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.addServers is not supported when config.database.uri is set to a databaseless folder path')
    const servers = settings.serversToAdd
    if (servers.length === 0) return
    let validServers = {}
    let invalidServers = []
    if (storage.bot.shard && storage.bot.shard.count > 0) {
      const results = await storage.bot.shard.broadcastEval(`
        const ids = ${JSON.stringify(servers)};
        const info = {}
        for (var x = 0; x < ids.length; ++x) {
          const guild = this.guilds.get(ids[x]);
          if (guild) info[guild.id] = guild.name
        }
        if (Object.keys(info).length > 0) info
      `)
      for (var x = 0; x < results.length; ++x) {
        if (results[x]) validServers = { ...validServers, ...results[x] }
      }
      for (const id of servers) {
        if (!validServers[id]) {
          invalidServers.push(id)
          log.general.warning(`Failed to add VIP backing to server ${id} due to missing guild`)
        }
      }
      delete settings.serversToAdd
    } else {
      for (const id of servers) {
        const guild = storage.bot.guilds.get(id)
        if (guild) validServers[id] = guild.name
        else invalidServers.push(id)
      }
      delete settings.serversToAdd
    }
    for (const id in validServers) {
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
    if (skipUpdateVIP) await exports.vips.uniformize(storage.vipUsers, storage.vipServers)
    else await exports.vips.update(storage.vipUsers[settings.id], true) // Uniformize is called by vips.update so no need to explicitly call it here
    return [ validServers, invalidServers ]
  },
  removeServers: async (settings, skipUpdateVIP) => {
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.removeServers is not supported when config.database.uri is set to a databaseless folder path')
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
      if (skipUpdateVIP) await exports.vips.uniformize(storage.vipUsers, storage.vipServers)
      else await exports.vips.update(storage.vipUsers[settings.id], true)
      // No need to call uniformize since exports.vips.update does this
    }
    log.general.success(`VIP servers have been successfully removed: ${successIds}.${failed.length > 0 ? ` The following were not removed due to incorrect backing: ${failed}` : ``}`)
    return [ success, failed ]
  },
  refresh: async () => {
    if (!config._vip) return
    if (!config.database.uri.startsWith('mongo')) throw new Error('dbOps.vips.refresh is not supported when config.database.uri is set to a databaseless folder path')
    if (!fs.existsSync(path.join(__dirname, '..', 'settings', 'vips.js'))) throw new Error('Missing VIP module')
    require('../settings/vips.js')(storage.bot)
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
