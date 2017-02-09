const initializeAllRSS = require('../rss/initializeall.js')
const startFeedSchedule = require('../util/startFeedSchedule.js')
const configChecks = require('../util/configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./updateJSON.js')
const checkGuild = require('../util/checkGuild.js')

module.exports = function (bot, callback) {
  var guildList = []
  var skippedFeeds = 0
  var initializedFeeds = 0
  var totalFeeds = 0
  var con;

  function endCon () {
    sqlCmds.end(con, function(err) {
      console.log("RSS Info: Finished initialization cycle.")
    });
    callback()
    startFeedSchedule(bot)
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
      checkGuild.names(bot, guildId);
      for (var rssIndex in rssList){
        checkGuild.roles(bot, guildId, rssIndex);
        if (configChecks.checkExists(guildId, rssIndex, true, true) && configChecks.validChannel(bot, guildId, rssIndex) !== false) {
          initializeAllRSS(con, configChecks.validChannel(bot, guildId, rssIndex), rssIndex, function() {
            initializedFeeds++;
            console.log(`${initializedFeeds}, ${totalFeeds}`)
            if (initializedFeeds + skippedFeeds == totalFeeds) endCon();
          });
        }
        else skippedFeeds++;
      }
    }
    if (skippedFeeds == totalFeeds) endCon();
  }

  fileOps.readDir('./sources', function (err, files) {
    if (err) throw err;
    files.forEach(function(guildRSS) {
      if (bot.guilds.get(guildRSS.replace(/.json/g, "")) != null) {
        try {
          let guild = require(`../sources/${guildRSS}`)
          guildList.push(guild);
          for (var y in guild.sources) totalFeeds++;
        }
        catch (err) {fileOps.checkBackup(guildRSS)}
      }
      else if (guildRSS !== "guild_id_here.json" && guildRSS !== "backup"){
        console.log(`RSS Guild Profile: ${guildRSS} was not found in bot's guild list. Skipping.`);
      }
    })
    if (totalFeeds == 0) {
      console.log("RSS Info: There are no active feeds.");
      return startFeedSchedule(bot);
    }
    else return start();
  })


}
