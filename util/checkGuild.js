// Check for guild names/role names changes

const dbOps = require('./dbOps.js')
const currentGuilds = require('./storage.js').currentGuilds
const log = require('./logger.js')

exports.roles = (bot, guildId, rssName) => {
  const guildRss = currentGuilds.get(guildId)
  const rssList = guildRss.sources
  const guild = bot.guilds.get(guildId)
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
          guildRss.sources[rssName][key].splice(roleIndex, 1)
          if (guildRss.sources[rssName][key].length === 0) delete guildRss.sources[rssName][key]
          log.guild.info(`(${roleOrUser.id}, ${roleOrUser.name}) ${index === 0 ? 'Role' : 'User'} has been removed due to guild deletion`, guild)
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
          delete guildRss.sources[rssName].filters[key][roleOrUserID]
          if (Object.keys(guildRss.sources[rssName].filters[key]).length === 0) delete guildRss.sources[rssName].filters[key]
          if (Object.keys(guildRss.sources[rssName].filters).length === 0) delete guildRss.sources[rssName].filters
          log.guild.info(`(${roleOrUserID}, ${filteredSubList[roleOrUserID].name}) ${index === 0 ? 'Role' : 'User'} has been removed due to guild deletion`, guild)
          changedInfo = true
        } else if ((index === 0 ? retrieved.name : retrieved.username) !== filteredSubList[roleOrUserID].name) {
          filteredSubList[roleOrUserID].name = index === 0 ? retrieved.name : retrieved.username
          changedInfo = true
        }
      }
    }
  })

  if (changedInfo) return dbOps.guildRss.update(guildRss).catch(err => log.general.warning('checkGuild.roles', guild, err))
}

exports.names = (bot, guildId) => {
  const guildRss = currentGuilds.get(guildId)
  const guild = bot.guilds.get(guildId)

  if (guildRss.name !== guild.name) {
    guildRss.name = guild.name
    dbOps.guildRss.update(guildRss).catch(err => log.general.warning('checkGuild.names', guild, err))
  }
}
