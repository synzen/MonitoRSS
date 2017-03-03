const fileOps = require('./fileOps.js')

exports.roles = function (bot, guildId, rssName) {
  var guildRss = require(`../sources/${guildId}.json`)
  var rssList = guildRss.sources
  var guild = bot.guilds.get(guildId)
  var changedInfo = false

  // global subs is an array of objects
  if (rssList[rssName].roleSubscriptions && rssList[rssName].roleSubscriptions.length !== 0) {
    var globalSubList = rssList[rssName].roleSubscriptions;
    for (let roleIndex in globalSubList) {
      var role = globalSubList[roleIndex]
      if (!guild.roles.get(role.roleID)) {
        console.log(`Guild Warning: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) has been deleted. Removing.`);
        guildRss.sources[rssName].roleSubscriptions.splice(roleIndex, 1);
        if (guildRss.sources[rssName].roleSubscriptions.length == 0) delete guildRss.sources[rssName].roleSubscriptions;
        changedInfo = true;
      }
      else if (guild.roles.get(role.roleID).name !== role.roleName) {
        console.log(`Guild Info: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) => Changed role name to ${guild.roles.get(role.roleID).name}`);
        role.roleName = guild.roles.get(role.roleID).name;
        changedInfo = true;
      }
    }
  }

  // filtered subs is an object
  if (rssList[rssName].filters && rssList[rssName].filters.roleSubscriptions && rssList[rssName].filters.roleSubscriptions.size() > 0) {
    let filteredSubList = rssList[rssName].filters.roleSubscriptions
    for (let roleID in filteredSubList) {
      if (!guild.roles.get(roleID)) {
        console.log(`Guild Warning: (${guild.id}, ${guild.name}) => Role (${roleID}, ${filteredSubList[roleID].roleName}) has been deleted. Removing.`);
        delete guildRss.sources[rssName].filters.roleSubscriptions[roleID];
        if (guildRss.sources[rssName].filters.roleSubscriptions.size() === 0) delete guildRss.sources[rssName].filters.roleSubscriptions;
        if (guildRss.sources[rssName].filters.size() === 0) delete guildRss.sources[rssName].filters;
        changedInfo = true;
      }
      else if (guild.roles.get(roleID).name !== filteredSubList[roleID].roleName) {
        console.log(`Guild Info: (${guild.id}, ${guild.name}) => Role (${roleID}, ${filteredSubList[roleID].roleName}) => Changed role name to ${guild.roles.get(roleID).name}`);
        filteredSubList[roleID].roleName = guild.roles.get(roleID).name;
        changedInfo = true;
      }
    }
  }

  if (changedInfo) return fileOps.updateFile(guildId, guildRss, `../sources/${guildId}.json`);
}

exports.names = function (bot, guildId) {
  var guildRss = require(`../sources/${guildId}.json`)
  var rssList = guildRss.sources
  var guild = bot.guilds.get(guildId)

  if (guildRss.name !== guild.name) {
    console.log(`Guild Info: (${guild.id}, ${guildRss.name}) => Name change detected, changed guild name from '${guildRss.name}' to '${guild.name}'.`);
    guildRss.name = guild.name;
    fileOps.updateFile(guildId, guildRss, `../sources/${guildId}.json`);
  }
}
