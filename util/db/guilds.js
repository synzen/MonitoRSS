const fs = require('fs')
const util = require('util')
const path = require('path')
const storage = require('../storage.js')
const config = require('../../config.js')
const redisIndex = require('../../structs/db/Redis/index.js')
const models = storage.models
const log = require('../logger.js')
const UPDATE_SETTINGS = { upsert: true, strict: true }
const FIND_PROJECTION = '-_id -__v'
const readdirPromise = util.promisify(fs.readdir)
const readFilePromise = util.promisify(fs.readFile)
const writeFilePromise = util.promisify(fs.writeFile)
const mkdirPromise = util.promisify(fs.mkdir)
const unlinkPromise = util.promisify(fs.unlink)

exports.get = async id => {
  if (config.database.uri.startsWith('mongo')) return models.GuildRss().findOne({ id }, FIND_PROJECTION).lean().exec()
  const filePath = path.join(config.database.uri, `${id}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(await readFilePromise(filePath))
}

exports.getMany = async ids => {
  if (config.database.uri.startsWith('mongo')) return models.GuildRss().find({ id: { $in: ids } }, FIND_PROJECTION).lean().exec()
  const promises = []
  for (const id of ids) promises.push(exports.get(id))
  return Promise.all(promises)
}

exports.getAll = async () => {
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
}

exports.update = async guildRss => {
  // Memory version
  if (!config.database.uri.startsWith('mongo')) {
    try {
      if (!fs.existsSync(path.join(config.database.uri))) await mkdirPromise(path.join(config.database.uri))
      await writeFilePromise(path.join(config.database.uri, `${guildRss.id}.json`), JSON.stringify(guildRss, null, 2))
    } catch (err) {
      throw err
    }
    return redisIndex.events.emitUpdatedProfile(guildRss.id)
  }

  // Database version
  // for (const key in guildRss) {
  //   const val = guildRss[key]
  //   if (!val) delete guildRss[key]
  //   else if (Array.isArray(val) && val.length === 0) delete guildRss[key]
  //   else if (typeof val === 'object' && val !== null && Object.keys(val).length === 0) delete guildRss[key]
  // }
  const res = await models.GuildRss().replaceOne({ id: guildRss.id }, guildRss, UPDATE_SETTINGS).exec()
  redisIndex.events.emitUpdatedProfile(guildRss.id)
  return res
}

exports.remove = async (guildRss, suppressLog) => {
  const guildId = guildRss.id
  if (guildRss && guildRss.sources && Object.keys(guildRss.sources).length > 0) exports.backup(guildRss).catch(err => log.general.warning('Unable to backup guild after remvoing', err, true))
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
    }
  }
  const res = await models.GuildRss().deleteOne({ id: guildId })
  if (!suppressLog) log.general.info(`Removed Guild document ${guildId}`)
  return res
}

exports.disableFeed = async (guildRss, rssName, reason) => {
  if (guildRss.sources[rssName].disabled) return log.general.warning(`Feed named ${rssName} is already disabled in guild ${guildRss.id}`)
  guildRss.sources[rssName].disabled = reason || 'No reason available'
  await exports.update(guildRss)
  log.general.warning(`Feed named ${rssName} (${guildRss.sources[rssName].link}) has been disabled in guild ${guildRss.id} (Reason: ${reason})`)
}

exports.enableFeed = async (guildRss, rssName, reason) => {
  if (!guildRss.sources[rssName].disabled) return log.general.info(`Feed named ${rssName} is already enabled in guild ${guildRss.id}`)
  delete guildRss.sources[rssName].disabled
  await exports.update(guildRss)
  log.general.info(`Feed named ${rssName} (${guildRss.sources[rssName].link}) has been enabled in guild ${guildRss.id} (Reason: ${reason})`)
}

exports.removeFeed = async (guildRss, rssName) => {
  const link = guildRss.sources[rssName].link
  delete guildRss.sources[rssName]
  storage.deletedFeeds.push(rssName)
  const res = await exports.update(guildRss)
  await storage.scheduleManager.removeScheduleOfFeed(rssName, link)
  return res
}

exports.backup = async guildRss => {
  if (!guildRss || exports.empty(guildRss, true)) return
  // Memory version
  if (!config.database.uri.startsWith('mongo')) {
    if (!fs.existsSync(path.join(config.database.uri, 'backup'))) {
      await mkdirPromise(path.join(config.database.uri, 'backup'))
    }
    await writeFilePromise(path.join(config.database.uri, 'backup', `${guildRss.id}.json`), JSON.stringify(guildRss, null, 2))
  }
  // Database version
  await models.GuildRssBackup().updateOne({ id: guildRss.id }, { $set: guildRss }, UPDATE_SETTINGS).exec()
}

exports.restore = async guildId => {
  // Memory version
  let guildRss
  if (!config.database.uri.startsWith('mongo')) {
    const backupPath = path.join(config.database.uri, 'backup', `${guildId}.json`)
    if (!fs.existsSync(backupPath)) return
    try {
      const json = await readFilePromise(backupPath)
      const parsed = JSON.parse(json)
      if (exports.empty(parsed, true)) guildRss = parsed
    } catch (err) {
      throw err
    }
  } else {
    // Database version
    guildRss = await models.GuildRssBackup().findOne({ id: guildId }, FIND_PROJECTION).lean().exec()
    if (!guildRss || exports.empty(guildRss, true)) return
  }

  await exports.update(guildRss)
  const rssList = guildRss.sources
  if (rssList) {
    for (var rssName in rssList) {
      const source = rssList[rssName]
      if (!storage.bot.channels.get(source.channel)) {
        await exports.removeFeed(guildRss, rssName)
        log.general.info(`Removed feed ${source.link} due to missing channel ${source.channel}`, storage.bot.guilds.get(guildRss.id))
      }
    }
  }
  await models.GuildRssBackup().deleteOne({ id: guildId })
  return guildRss
}

exports.empty = (guildRss, skipRemoval) => { // Used on the beginning of each cycle to check for empty sources per guild
  if (guildRss.sources && Object.keys(guildRss.sources).length > 0) return false
  if (!guildRss.timezone && !guildRss.dateFormat && !guildRss.dateLanguage && !guildRss.prefix && (!guildRss.sendAlertsTo || guildRss.sendAlertsTo.length === 0)) { // Delete only if server-specific special settings are not found
    if (!skipRemoval) {
      exports.remove(guildRss, true)
        .catch(err => log.general.error(`(G: ${guildRss.id}) Could not delete guild due to 0 sources`, err))
    }
  } else log.general.info(`(G: ${guildRss.id}) 0 sources found, skipping`)
  return true
}

exports.dropBackupIndexes = async () => {
  // Dropping the indexes removes auto-expiration on guild backup documents
  try {
    await models.GuildRssBackup().collection.dropIndexes()
  } catch (err) {
    if (err.code !== 26) throw err // 26 means does not exist - resolve the promise in this case
  }
}
