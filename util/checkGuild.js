// Check for guild names/role names changes

const fileOps = require('./fileOps.js')
const currentGuilds = require('./storage.js').currentGuilds

exports.roles = function (bot, guildId, rssName) {
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
        console.log(`Guild Warning: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) has been deleted. Removing.`)
        guildRss.sources[rssName].roleSubscriptions.splice(roleIndex, 1)
        if (guildRss.sources[rssName].roleSubscriptions.length === 0) delete guildRss.sources[rssName].roleSubscriptions
        changedInfo = true
      } else if (guild.roles.get(role.roleID).name !== role.roleName) {
        console.log(`Guild Info: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) => Changed role name to ${guild.roles.get(role.roleID).name}`)
        role.roleName = guild.roles.get(role.roleID).name
        changedInfo = true
      }
    }
  }

  // filtered subs is an object
  if (rssList[rssName].filters && rssList[rssName].filters.roleSubscriptions && rssList[rssName].filters.roleSubscriptions.size() > 0) {
    const filteredSubList = rssList[rssName].filters.roleSubscriptions
    for (var roleID in filteredSubList) {
      if (!guild.roles.get(roleID)) {
        console.log(`Guild Warning: (${guild.id}, ${guild.name}) => Role (${roleID}, ${filteredSubList[roleID].roleName}) has been deleted. Removing.`)
        delete guildRss.sources[rssName].filters.roleSubscriptions[roleID]
        if (guildRss.sources[rssName].filters.roleSubscriptions.size() === 0) delete guildRss.sources[rssName].filters.roleSubscriptions
        if (guildRss.sources[rssName].filters.size() === 0) delete guildRss.sources[rssName].filters
        changedInfo = true
      } else if (guild.roles.get(roleID).name !== filteredSubList[roleID].roleName) {
        console.log(`Guild Info: (${guild.id}, ${guild.name}) => Role (${roleID}, ${filteredSubList[roleID].roleName}) => Changed role name to ${guild.roles.get(roleID).name}`)
        filteredSubList[roleID].roleName = guild.roles.get(roleID).name
        changedInfo = true
      }
    }
  }

  if (changedInfo) return fileOps.updateFile(guildId, guildRss)
}

exports.names = function (bot, guildId) {
  const guildRss = currentGuilds.get(guildId)
  const guild = bot.guilds.get(guildId)

  if (guildRss.name !== guild.name) {
    console.log(`Guild Info: (${guild.id}, ${guildRss.name}) => Name change detected, changed guild name from '${guildRss.name}' to '${guild.name}'.`)
    guildRss.name = guild.name
    fileOps.updateFile(guildId, guildRss)
  }
}
