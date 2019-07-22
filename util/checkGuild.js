// Check for guild names/role names changes

const dbOps = require('./dbOps.js')
const log = require('./logger.js')
const fs = require('fs')
const path = require('path')
const missingChannelCount = {}
const storage = require('./storage.js')
const files = fs.readdirSync(path.join(__dirname, '..', 'updates'))
const semVerSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
const versions = files.filter(name => /\d{1}\.\d{1}\.\d{1}\.js/.test(name)).sort(semVerSort).map(file => file.replace('.js', '')) // Filter in and sort the versions
// if (versions.concat(currentVersion).sort(semVerSort)[versions.length] !== currentVersion) throw new Error('Package version found to be lower than update files. Either updates or package.json is outdated')

const fetchUserWrapper = (bot, id) => new Promise((resolve, reject) => {
  bot.fetchUser(id).then(resolve).catch(err => {
    if (err.code === 10013) resolve() // Unknown User
    else reject(err)
  })
})

// Returns true or false whether the calling function should update
exports.subscriptions = async (bot, guildRss) => {
  const guild = bot.guilds.get(guildRss.id)
  const idsToRemove = []
  let toUpdate = false

  if (guildRss.name !== guild.name) {
    guildRss.name = guild.name
    toUpdate = true
  }

  const rssList = guildRss.sources
  if (!rssList) return toUpdate

  const fetchUserPromises = []
  const fetchUserIDRecord = []
  const subscriberUserNames = {}

  for (const rssName in rssList) {
    const source = rssList[rssName]
    const subscribers = source.subscribers
    if (!subscribers) continue
    for (const subscriber of subscribers) {
      const id = subscriber.id
      const type = subscriber.type
      if (type === 'user') {
        fetchUserPromises.push(fetchUserWrapper(bot, id))
        fetchUserIDRecord.push(id)
        subscriberUserNames[id] = subscriber.name || 0
      } else if (type === 'role') {
        const role = guild.roles.get(id)
        if (!role) {
          idsToRemove.push(id)
        } else if (role.name !== subscriber.name) {
          subscriber.name = role.name
          toUpdate = true
        }
      } else {
        idsToRemove.push(id)
      }
    }
  }

  const userFetches = await Promise.all(fetchUserPromises)
  const subscriberUserNamesToUpdate = {}
  for (let i = 0; i < userFetches.length; ++i) {
    const user = userFetches[i]
    const id = fetchUserIDRecord[i]
    if (!user) idsToRemove.push(id)
    else if (subscriberUserNames[id] !== user.username) {
      subscriberUserNamesToUpdate[id] = user.username
      toUpdate = true
    }
  }

  if (idsToRemove.length === 0 && !toUpdate) return false

  for (const rssName in rssList) {
    const subscribers = rssList[rssName].subscribers
    if (!subscribers) continue
    for (let i = subscribers.length - 1; i >= 0; --i) {
      const subscriber = subscribers[i]
      const id = subscriber.id
      if (idsToRemove.includes(id)) subscribers.splice(i, 1)
      else if (subscriberUserNamesToUpdate[id]) subscriber.name = subscriberUserNamesToUpdate[id]
    }
    if (subscribers.length === 0) delete rssList[rssName].subscribers
  }

  return true
}

exports.config = (bot, guildRss, rssName, logging) => {
  const guildId = guildRss.id
  const source = guildRss.sources[rssName]
  const guild = bot.guilds.get(guildId)
  const channel = bot.channels.get(source.channel)
  // if (source.disabled === true) {
  //   if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} is disabled in channel ${source.channel}, skipping...`)
  //   return false
  // }
  if (!source.link || !source.link.startsWith('http')) {
    if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} has no valid link defined, skipping...`)
    return false
  }
  if (!source.channel) {
    if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} has no channel defined, skipping...`)
    return false
  }
  const shardPrefix = bot.shard && bot.shard.count > 0 ? `SH ${bot.shard.id} ` : ''

  if (!channel) {
    log.cycle.warning(`${shardPrefix}Channel ${source.channel} in guild ${guildId} for feed ${source.link} was not found, skipping source`, guild)
    missingChannelCount[rssName] = missingChannelCount[rssName] ? missingChannelCount[rssName] + 1 : 1
    if (missingChannelCount[rssName] >= 3 && storage.initialized) {
      dbOps.guildRss.removeFeed(guildRss, rssName)
        .then(() => {
          log.general.info(`Removed feed ${source.link} from guild ${guildId} due to excessive missing channels warnings`)
          delete missingChannelCount[rssName]
        })
        .catch(err => log.general.warning(`Unable to remove feed ${source.link} from guild ${guildId} due to excessive missing channels warning`, err))
    }
    return false
  } else {
    if (missingChannelCount[rssName]) delete missingChannelCount[rssName]

    // Check channel permissions
    let populatedEmbeds = false
    if (source.embeds && source.embeds.length > 0) {
      for (const embed of source.embeds) {
        if (Object.keys(embed).length > 0) populatedEmbeds = true
      }
    }
    const permissions = guild.me.permissionsIn(channel)
    const allowView = permissions.has('VIEW_CHANNEL')
    const allowSendMessages = permissions.has('SEND_MESSAGES')
    const allowEmbedLinks = !populatedEmbeds ? true : permissions.has('EMBED_LINKS')
    if (!source.webhook && (!allowSendMessages || !allowEmbedLinks || !allowView)) {
      let reasons = []
      if (!allowSendMessages) reasons.push('SEND_MESSAGES')
      if (!allowEmbedLinks) reasons.push('EMBED_LINKS')
      if (!allowView) reasons.push('VIEW_CHANNEL')
      const reason = `Missing permissions ${reasons.join(', ')}`
      if (!source.disabled) dbOps.guildRss.disableFeed(guildRss, rssName, reason).catch(err => log.general.warning(`Failed to disable feed ${rssName} due to missing permissions (${reason})`, guild, err))
      else if (source.disabled.startsWith('Missing permissions') && source.disabled !== reason) {
        source.disabled = reason
        dbOps.guildRss.update(guildRss).catch(err => log.general.warning(`Failed to update disabled reason for feed ${rssName}`, guild, err))
      }
      return false
    } else if (source.disabled && source.disabled.startsWith('Missing permissions')) {
      dbOps.guildRss.enableFeed(guildRss, rssName, `Found channel permissions`)
        .catch(err => log.general.warning('Failed to enable feed after channel permissions found', err))
      return true
    }

    // For any other non-channel-permission related reason, just return !source.disabled
    if (logging && source.disabled) log.cycle.warning(`${rssName} in guild ${guildRss.id} is disabled in channel ${source.channel}, skipping...`)
    return !source.disabled
  }
}

// Returns true or false whether the calling function should update
exports.version = guildRss => {
  const guildVersion = guildRss.version
  let changed = false
  // Anything with no version attached must be below 5.0.0. Run all updates.
  if (!guildVersion) {
    for (const version of versions) {
      const updated = require(`../updates/${version}.js`).updateGuildRss
      if (updated(guildRss)) changed = true
    }
  } else {
    const versionIndex = versions.indexOf(guildVersion)
    if (versionIndex !== -1) {
      // There is an update file found for this version, so run every version past it
      for (let i = versionIndex; i < versions.length; ++i) {
        const updateFile = require(`../updates/${versions[i]}.js`)
        const updated = updateFile.updateGuildRss
        // Sometimes the current version should be rerun
        if (i === versionIndex && updateFile.rerun && updated(guildRss)) changed = true
        else if (i > versionIndex) {
          const updated = updateFile.updateGuildRss
          if (updated(guildRss)) changed = true
        }
      }
    } else {
      // No update file found for this version, so concat the guild's version with the existing versions, sort it, and run every update past it
      const withGuildVersion = versions.concat(guildVersion).sort(semVerSort)
      const indexOfGuildVersion = withGuildVersion.indexOf(guildVersion)
      for (let i = indexOfGuildVersion + 1; i < withGuildVersion.length; ++i) {
        const updated = require(`../updates/${withGuildVersion[i]}.js`).updateGuildRss
        if (updated(guildRss)) changed = true
      }
    }
  }
  return changed
}
