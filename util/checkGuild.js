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

exports.subscriptions = (bot, guildRss) => {
  const guild = bot.guilds.get(guildRss.id)
  const idsToRemove = []

  if (guildRss.name !== guild.name) {
    guildRss.name = guild.name
    dbOps.guildRss.update(guildRss).catch(err => log.general.warning('checkGuild', guild, err))
  }

  const rssList = guildRss.sources
  if (!rssList) return
  let subscriptionsTotal = 0
  let subscriptionsChecked = 0

  function updateGuildRss () {
    if (idsToRemove.length === 0) return
    for (const rssName in rssList) {
      const subscribers = rssList[rssName].subscribers
      if (!subscribers) continue
      for (let i = subscribers.length - 1; i >= 0; --i) {
        const subscriber = subscribers[i]
        if (idsToRemove.includes(subscriber.id)) subscribers.splice(i, 1)
      }
      if (subscribers.length === 0) delete rssList[rssName].subscribers
    }
    dbOps.guildRss.update(guildRss).then(() => log.guild.info(`Updated after checkGuild`, guild)).catch(err => log.general.warning('checkGuild', guild, err))
  }

  function finishSubscriptionCheck () {
    if (++subscriptionsChecked === subscriptionsTotal) updateGuildRss()
  }

  for (const rssName in rssList) {
    if (rssList[rssName].subscribers) subscriptionsTotal += rssList[rssName].subscribers.length
  }

  for (const rssName in rssList) {
    const source = rssList[rssName]
    const subscribers = source.subscribers
    if (!subscribers) return
    for (const subscriber of subscribers) {
      const id = subscriber.id
      const type = subscriber.type
      if (type === 'user') {
        bot.fetchUser(id)
          .then(user => finishSubscriptionCheck())
          .catch(err => {
            log.guild.info(`(${id}, ${subscriber.name}) Unable to fetch during checkGuild. Preparing for removal.`, guild, err)
            idsToRemove.push(id)
            finishSubscriptionCheck()
          })
      } else if (type === 'role') {
        const retrieved = guild.roles.get(id)
        if (retrieved) finishSubscriptionCheck()
        else {
          log.guild.info(`(${id}, ${subscriber.name}) Nonexistent subscriber ${id} (${type}). Preparing for removal`, guild)
          idsToRemove.push(id)
          finishSubscriptionCheck()
        }
      } else {
        idsToRemove.push(id)
        log.guild.info(`Invalid subscriber type for member shown below. Preparing for removal.`, guild)
        console.log(subscriber)
        finishSubscriptionCheck()
      }
    }
  }
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
  return changed ? dbOps.guildRss.update(guildRss) : null
}
