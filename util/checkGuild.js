// Check for guild names/role names changes

const dbOps = require('./dbOps.js')
const log = require('./logger.js')
const missingChannelCount = {}
const storage = require('./storage.js')

exports.subscriptions = (bot, guildRss) => {
  const guild = bot.guilds.get(guildRss.id)

  if (guildRss.name !== guild.name) {
    guildRss.name = guild.name
    dbOps.guildRss.update(guildRss).catch(err => log.general.warning('checkGuild.names', guild, err))
  }
  const rssList = guildRss.sources
  if (!rssList) return
  for (const rssName in rssList) {
    let changedInfo = false

    const subscriptionTypeKeyNames = ['roleSubscriptions', 'userSubscriptions']

    // global subs is an array of objects
    subscriptionTypeKeyNames.forEach((key, index) => {
      if (rssList[rssName][key] && rssList[rssName][key].length !== 0) {
        const globalSubList = rssList[rssName][key]
        for (const roleIndex in globalSubList) {
          const roleOrUser = globalSubList[roleIndex]
          const retrieved = index === 0 ? guild.roles.get(roleOrUser.id) : guild.members.get(roleOrUser.id).user
          if (!retrieved) {
            const id = roleOrUser.id
            const name = roleOrUser.name
            guildRss.sources[rssName][key].splice(roleIndex, 1)
            if (guildRss.sources[rssName][key].length === 0) delete guildRss.sources[rssName][key]
            log.guild.info(`(${id}, ${name}) ${index === 0 ? 'Role' : 'User'} preparing for removal due to guild deletion`, guild)
            changedInfo = true
          } else if ((index === 0 ? retrieved.name : retrieved.username) !== roleOrUser.name) {
            roleOrUser.name = index === 0 ? retrieved.name : retrieved.username
            changedInfo = true
          }
        }
      }

      // filtered subs is an object
      if (rssList[rssName].filters && rssList[rssName].filters[key] && Object.keys(rssList[rssName].filters[key]).length > 0) {
        const filteredSubList = rssList[rssName].filters[key]
        for (const roleOrUserID in filteredSubList) {
          const retrieved = index === 0 ? guild.roles.get(roleOrUserID) : guild.members.get(roleOrUserID).user
          if (!retrieved) {
            const name = filteredSubList[roleOrUserID].name
            delete guildRss.sources[rssName].filters[key][roleOrUserID]
            if (Object.keys(guildRss.sources[rssName].filters[key]).length === 0) delete guildRss.sources[rssName].filters[key]
            if (Object.keys(guildRss.sources[rssName].filters).length === 0) delete guildRss.sources[rssName].filters
            log.guild.info(`(${roleOrUserID}, ${name}) ${index === 0 ? 'Role' : 'User'} preparing for removal due to guild deletion`, guild)
            changedInfo = true
          } else if ((index === 0 ? retrieved.name : retrieved.username) !== filteredSubList[roleOrUserID].name) {
            filteredSubList[roleOrUserID].name = index === 0 ? retrieved.name : retrieved.username
            changedInfo = true
          }
        }
      }
    })

    if (changedInfo) dbOps.guildRss.update(guildRss).then(() => log.guild.info(`Updated`, guild)).catch(err => log.general.warning('checkGuild.roles', guild, err))
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
    if (missingChannelCount[rssName]) delete missingChannelCount[rssName]
    return true
  }
}
