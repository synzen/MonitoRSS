module.exports = function(bot, guild, rssList) {
  var finalList = []
  var botRole = guild.members.get(bot.user.id).highestRole;
  for (var rssName in rssList) {
    let globalSubList = rssList[rssName].roleSubscriptions;
    let filterList = rssList[rssName].filters;
    var roles = [];
    // globalSubList is an array
    if (typeof globalSubList === 'object' && globalSubList.length > 0) {
      for (var globalSubber in globalSubList) {
        let subbedRole = guild.roles.get(globalSubList[globalSubber].roleID);
        if (subbedRole.comparePositionTo(botRole) < 0) roles.push(subbedRole.id);
      }
    }
    // filteredSubList is an object with role IDs as key
    if (typeof filterList === 'object' && typeof filterList.roleSubscriptions === 'object') {
      for (var filteredSubber in filterList.roleSubscriptions) {
        let subbedRole = guild.roles.get(filteredSubber);
        if (subbedRole.comparePositionTo(botRole) < 0) roles.push(filteredSubber);
      }
    }
    if (roles.length !== 0) finalList.push({source: rssList[rssName], roleList: roles});
  }
  if (finalList.length === 0) return null;
  else return finalList;
}
