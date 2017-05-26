const fileOps = require('../util/fileOps.js')
const currentGuilds = require('../util/storage.js').currentGuilds

module.exports = function (bot, role) {
  const guildRss = currentGuilds.get(role.guild.id)
  if (!guildRss || !guildRss.sources || !guildRss.sources.size() === 0) return
  const rssList = guildRss.sources
  let found = false

  // Delete from global role subscriptions if exists
  for (var rssName in rssList) {
    const source = rssList[rssName]

    if (source.roleSubscriptions) {
      let globalSubList = source.roleSubscriptions
      for (var globalSub in globalSubList) {
        if (globalSubList[globalSub].roleID === role.id) {
          globalSubList.splice(globalSub, 1)
          found = true
        }
      }
    }

    // Delete from filtered role subscriptions if exists
    if (source.filters && source.filters.roleSubscriptions && source.filters.roleSubscriptions[role.id]) {
      delete source.filters.roleSubscriptions[role.id]
      found = true
    }

    // Cleanup for empty objects
    if (source.filters && source.filters.roleSubscriptions && source.filters.roleSubscriptions.size() === 0) delete source.filters.roleSubscriptions
    if (source.filters && source.filters.size() === 0) delete source.filters
    if (source.roleSubscriptions && source.roleSubscriptions.length === 0) delete source.roleSubscriptions
  }

  if (!found) return

  console.log(`Guild Info: (${role.guild.id}, ${role.guild.name}) => Role (${role.id}, ${role.name}) has been removed from config by guild role deletion.`)
  fileOps.updateFile(role.guild.id, guildRss)
}
