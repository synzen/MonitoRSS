const dbOps = require('../util/dbOps.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const log = require('../util/logger.js')

module.exports = (bot, role) => {
  const guildRss = currentGuilds.get(role.guild.id)
  if (!guildRss || !guildRss.sources || !Object.keys(guildRss.sources).length === 0) return
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
    if (source.filters && source.filters.roleSubscriptions && Object.keys(source.filters.roleSubscriptions).length === 0) delete source.filters.roleSubscriptions
    if (source.filters && Object.keys(source.filters).length === 0) delete source.filters
    if (source.roleSubscriptions && source.roleSubscriptions.length === 0) delete source.roleSubscriptions
  }

  if (!found) return

  dbOps.guildRss.update(guildRss)
    .then(() => log.guild.info(`Role has been removed from config by guild role deletion`, role.guild, role))
    .catch(err => log.guild.warning(`Role could not be removed from config by guild role deletion`, role.guild, role, err))
}
