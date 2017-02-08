const fileOps = require('./updateJSON.js')

function isEmptyObject(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return JSON.stringify(obj) === JSON.stringify({});
}

exports.roles = function (bot, guildId, rssIndex) {
  var guildRss = require(`../sources/${guildId}.json`)
  var rssList = guildRss.sources
  var guild = bot.guilds.get(guildId)
  var changedInfo = false

  //global subs is an array of objects
  if (rssList[rssIndex].roleSubscriptions != null && rssList[rssIndex].roleSubscriptions.length !== 0) {
    var globalSubList = rssList[rssIndex].roleSubscriptions;
    for (let roleIndex in globalSubList) {
      var role = globalSubList[roleIndex]
      if (guild.roles.get(role.roleID) == null) {
        console.log(`Guild Warning: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) has been deleted. Removing.`);
        guildRss.sources[rssIndex].roleSubscriptions.splice(roleIndex, 1);
        if (guildRss.sources[rssIndex].roleSubscriptions.length == 0) delete guildRss.sources[rssIndex].roleSubscriptions;
        changedInfo = true;
      }
      else if (guild.roles.get(role.roleID).name !== role.roleName) {
        console.log(`Guild Info: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) => Changed role name to ${guild.roles.get(role.roleID).name}`);
        role.roleName = guild.roles.get(role.roleID).name;
        changedInfo = true;
      }
    }
  }

  //filtered subs is an object
  if (rssList[rssIndex].filters != null && rssList[rssIndex].filters.roleSubscriptions != null && !isEmptyObject(rssList[rssIndex].filters.roleSubscriptions)) {
    let filteredSubList = rssList[rssIndex].filters.roleSubscriptions
    for (let roleID in filteredSubList) {
      if (guild.roles.get(roleID) == null) {
        console.log(`Guild Warning: (${guild.id}, ${guild.name}) => Role (${roleID}, ${filteredSubList[roleID].roleName}) has been deleted. Removing.`);
        delete guildRss.sources[rssIndex].filters.roleSubscriptions[roleID];
        if (isEmptyObject(guildRss.sources[rssIndex].filters.roleSubscriptions)) delete guildRss.sources[rssIndex].filters.roleSubscriptions;
        if (isEmptyObject(guildRss.sources[rssIndex].filters)) delete guildRss.sources[rssIndex].filters;
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
    console.log(`Guild Info: (${guild.id}, ${guildRss.name}) => Name change detected, changed guild name from "${guildRss.name}" to "${guild.name}".`);
    guildRss.name = guild.name;
    fileOps.updateFile(guildId, guildRss, `../sources/${guildId}.json`);
  }
}
