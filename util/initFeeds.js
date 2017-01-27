const initializeAllRSS = require('../rss/initializeall.js')
const startFeedSchedule = require('../util/startFeedSchedule.js')
const configChecks = require('../util/configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./updateJSON.js')
const fs = require('fs')

module.exports = function (bot) {

  var guildList = []
  var skippedFeeds = 0
  var initializedFeeds = 0
  var totalFeeds = 0

  var con;

  function isEmptyObject(obj) {
      for(var prop in obj) {
          if(obj.hasOwnProperty(prop))
              return false;
      }
      return JSON.stringify(obj) === JSON.stringify({});
  }

  function roleCheck (guildId, rssIndex) {
    var guildRss = require(`../sources/${guildId}.json`)
    var rssList = guildRss.sources
    var guild = bot.guilds.get(guildId)
    var changedInfo = false

    if (rssList[rssIndex].roleSubscriptions != null && rssList[rssIndex].roleSubscriptions.length !== 0) {
      var globalSubList = rssList[rssIndex].roleSubscriptions;
      for (let roleIndex in globalSubList) {
        var role = globalSubList[roleIndex]
        if (guild.roles.get(role.roleID) == null) {
          console.log(`RSS Warning: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) not found.`);
          changedInfo = true;
        }
        else if (guild.roles.get(role.roleID).name !== role.roleName) {
          console.log(`RSS Info: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) => Changed role name to ${guild.roles.get(role.roleID).name}`);
          role.roleName = guild.roles.get(role.roleID).name;
          changedInfo = true;
        }
      }
    }

    if (rssList[rssIndex].filters != null && rssList[rssIndex].filters.roleSubscriptions != null && !isEmptyObject(rssList[rssIndex].filters.roleSubscriptions)) {
      let filteredSubList = rssList[rssIndex].filters.roleSubscriptions
      for (let roleID in filteredSubList) {
        if (guild.roles.get(roleID) == null) {
          console.log(`RSS Warning: (${guild.id}, ${guild.name}) => Role (${role.roleID}, ${role.roleName}) not found.`);
          changedInfo = true;
        }
        else if (guild.roles.get(roleID).name !== filteredSubList[roleID].roleName) {
          console.log(`RSS Info: (${guild.id}, ${guild.name}) => Role (${roleID}, ${filteredSubList[roleID].roleName}) => Changed role name to ${guild.roles.get(roleID).name}`);
          filteredSubList[roleID].roleName = guild.roles.get(roleID).name;
          changedInfo = true;
        }
      }
    }

    if (changedInfo) return fileOps.updateFile(`./sources/${guildId}.json`, guildRss, `../sources/${guildId}.json`);
    else return;

  }

  function endCon () {
    sqlCmds.end(con, function(err) {
      console.log("RSS Info: Finished initialization cycle.")
    });
    startFeedSchedule(bot);
  }

  function start () {
    console.log("RSS Info: Starting initialization cycle.")
    con = sqlConnect(startBot);
    if (con == null) throw "RSS Error: SQL type is not correctly defined in config";
  }

  function startBot () {
    for (var guildIndex in guildList) {
      let guildId = guildList[guildIndex].id
      let rssList = guildList[guildIndex].sources
      for (var rssIndex in rssList){
        roleCheck(guildId, rssIndex);
        if (configChecks.checkExists(guildId, rssIndex, true, true) && configChecks.validChannel(bot, guildId, rssIndex) !== false) {
          initializeAllRSS(con, configChecks.validChannel(bot, guildId, rssIndex), rssIndex, function() {
            initializedFeeds++;
            if (initializedFeeds + skippedFeeds == totalFeeds) endCon();
          });
        }
        else skippedFeeds++;
      }
    }
    if (skippedFeeds == totalFeeds) endCon();
  }

  fs.readdir('./sources', function(err, files) {
    if (err) throw err;
    files.forEach(function(guildRSS) {
      if (bot.guilds.get(guildRSS.replace(/.json/g, "")) != null) {
        let guild = require(`../sources/${guildRSS}`)
        guildList.push(guild);
        for (var y in guild.sources) totalFeeds++;
      }
      else if (guildRSS !== "guild_id_here.json"){
        console.log(`RSS Guild Info: ${guildRSS} was not found in bot's guild list. Skipping.`);
      }
    })
    if (totalFeeds == 0) {
      console.log("RSS Info: There are no active feeds.");
      return startFeedSchedule(bot);
    }
    else return start();
  })


}
