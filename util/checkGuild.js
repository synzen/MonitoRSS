// Check for guild names/role names changes

const dbOps = require('./dbOps.js')
const log = require('./logger.js')
const missingChannelCount = {}
const storage = require('./storage.js')

exports.subscriptions = (bot, guildRss) => {
  const guild = bot.guilds.get(guildRss.id)
  const subscriptionTypeKeyNames = ['globalSubscriptions', 'filteredSubscriptions']
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
      for (const subscriptionType of subscriptionTypeKeyNames) {
        const reference = rssList[rssName][subscriptionType]
        if (!reference) continue
        for (let i = reference.length - 1; i >= 0; --i) {
          const subscriber = reference[i]
          if (idsToRemove.includes(subscriber.id)) reference.splice(i, 1)
        }
        if (reference.length === 0) delete rssList[rssName][subscriptionType]
      }
    }
    dbOps.guildRss.update(guildRss).then(() => log.guild.info(`Updated after checkGuild`, guild)).catch(err => log.general.warning('checkGuild', guild, err))
  }

  function finishSubscriptionCheck () {
    if (++subscriptionsChecked === subscriptionsTotal) updateGuildRss()
  }

  for (const rssName in rssList) {
    subscriptionTypeKeyNames.forEach(subscriptionType => {
      if (rssList[rssName][subscriptionType]) subscriptionsTotal += rssList[rssName][subscriptionType].length
    })
  }

  for (const rssName in rssList) {
    const source = rssList[rssName]
    subscriptionTypeKeyNames.forEach(subscriptionType => {
      const reference = source[subscriptionType]
      if (!reference) return
      for (let i = reference.length - 1; i >= 0; --i) {
        const subscriber = reference[i]
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
    })
  }
}

exports.config = (bot, guildRss, rssName, logging) => {
  const guildId = guildRss.id
  const source = guildRss.sources[rssName]
  if (source.disabled === true) {
    if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} is disabled in channel ${source.channel}, skipping...`)
    return false
  }
  if (!source.link || !source.link.startsWith('http')) {
    if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} has no valid link defined, skipping...`)
    return false
  }
  if (!source.channel) {
    if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} has no channel defined, skipping...`)
    return false
  }

  const channel = bot.channels.get(source.channel)
  const guild = bot.guilds.get(guildId)
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
    if (!source.channelName) {
      source.channelName = channel.name
      dbOps.guildRss.update(guildRss).catch(err => log.general.info(`(G: ${guildRss.id}, ${guildRss.name}) Unable to update channel name for source`, err))
    }
    if (missingChannelCount[rssName]) delete missingChannelCount[rssName]
    return true
  }
}
