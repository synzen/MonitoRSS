// Check for guild names/role names changes

const dbOps = require('./dbOps.js')
const currentGuilds = require('./storage.js').currentGuilds
const log = require('./logger.js')

exports.roles = (bot, guildId, rssName) => {
  const guildRss = currentGuilds.get(guildId)
  const rssList = guildRss.sources
  const guild = bot.guilds.get(guildId)
  let changedInfo = false

  // global subs is an array of objects
  if (rssList[rssName].roleSubscriptions && rssList[rssName].roleSubscriptions.length !== 0) {
    const globalSubList = rssList[rssName].roleSubscriptions
    for (var roleIndex in globalSubList) {
      const role = globalSubList[roleIndex]
      if (!guild.roles.get(role.roleID)) {
        guildRss.sources[rssName].roleSubscriptions.splice(roleIndex, 1)
        if (guildRss.sources[rssName].roleSubscriptions.length === 0) delete guildRss.sources[rssName].roleSubscriptions
        log.guild.info(`(${role.roleID}, ${role.roleName}) Role has been removed due to guild deletion`, guild)
        changedInfo = true
      } else if (guild.roles.get(role.roleID).name !== role.roleName) {
        role.roleName = guild.roles.get(role.roleID).name
        changedInfo = true
      }
    }
  }

  // filtered subs is an object
  if (rssList[rssName].filters && rssList[rssName].filters.roleSubscriptions && Object.keys(rssList[rssName].filters.roleSubscriptions).length > 0) {
    const filteredSubList = rssList[rssName].filters.roleSubscriptions
    for (var roleID in filteredSubList) {
      if (!guild.roles.get(roleID)) {
        delete guildRss.sources[rssName].filters.roleSubscriptions[roleID]
        if (Object.keys(guildRss.sources[rssName].filters.roleSubscriptions).length === 0) delete guildRss.sources[rssName].filters.roleSubscriptions
        if (Object.keys(guildRss.sources[rssName].filters).length === 0) delete guildRss.sources[rssName].filters
        log.guild.info(`(${roleID}, ${filteredSubList[roleID].roleName}) Role has been removed due to guild deletion`, guild)
        changedInfo = true
      } else if (guild.roles.get(roleID).name !== filteredSubList[roleID].roleName) {
        filteredSubList[roleID].roleName = guild.roles.get(roleID).name
        changedInfo = true
      }
    }
  }

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
