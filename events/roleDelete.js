const fileOps = require('../util/fileOps.js')
const currentGuilds = require('../util/fetchInterval.js').currentGuilds

module.exports = function (bot, role) {
  if (!currentGuilds[role.guild.id] || !currentGuilds[role.guild.id].sources || !currentGuilds[role.guild.id].sources.size() === 0) return;
  const guildRss = currentGuilds[role.guild.id]
  const rssList = guildRss.sources
  let found = false

  //delete from global role subscriptions if exists
  for (var rssName in rssList) {
    const source = rssList[rssName]
    if (source.roleSubscriptions) {
      let globalSubList = source.roleSubscriptions;
      for (var globalSub in globalSubList) {
        if (globalSubList[globalSub].roleID == role.id) {
          globalSubList.splice(globalSub, 1);
          found = true;
        }
      }
    }
    //delete from filtered role subscriptions if exists
    if (source.filters && source.filters.roleSubscriptions && source.filters.roleSubscriptions[role.id]) {
      delete source.filters.roleSubscriptions[role.id];
      found = true;
    }
    if (source.filters && source.filters.roleSubscriptions.size() === 0) delete source.filters.roleSubscriptions;
    //cleanup
    if (source.filters && source.filters.size() === 0) delete source.filters;
    if (source.roleSubscriptions && source.roleSubscriptions.length === 0) delete source.roleSubscriptions;
  }

  if (found) {
    console.log(`Guild Info: (${role.guild.id}, ${role.guild.name}) => Role (${role.id}, ${role.name}) has been deleted. Removing.`);
    return fileOps.updateFile(role.guild.id, guildRss);
  }

}
