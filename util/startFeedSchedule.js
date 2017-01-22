const configChecks = require('./configCheck.js')
const getRSS = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fs = require('fs')
const rssConfig = require('../config.json')

module.exports = function (bot) {
  var rssConfig = require('../config.json')

  var cycleInProgress = false
  var guildList = []
  var feedLength = 0
  var feedsProcessed = 0
  var feedsSkipped = 0

  var con

  function endCon (startingCycle) {
    sqlCmds.end(con, function(err) {
      console.log("RSS Info: Finished feed retrieval cycle. " + new Date())
    });
    cycleInProgress = false
    if (startingCycle) setTimeout(connect, 1000);
  }

  function connect () {
    if (cycleInProgress) {
      console.log(`RSS Info: Previous cycle was unable to finish. Forcing cycle end.`);
      endCon(true);
    }
    else {
      cycleInProgress = true
      //console.log("RSS Info: Starting feed retrieval cycle.")
      feedLength = feedsProcessed = feedsSkipped = 0
      guildList = []
      fs.readdir('./sources', function(err, files) {
        if (err) throw err;
        files.forEach(function(guildRSS) {
          if (bot.guilds.get(guildRSS.replace(/.json/g, "")) != null) {
            let guild = require(`../sources/${guildRSS}`)
            guildList.push(guild);
            for (var y in guild.sources) feedLength++;
          }
          else if (guildRSS !== "guild_id_here.json") console.log(`RSS Warning: File ${guildRSS} was not found. Skipping file.`);
        })
        if (feedLength == 0) {
          cycleInProgress = false;
          return console.log("RSS Info: Finished feed retrieval cycle. No feeds to retrieve. " + new Date());
        }
        else con = sqlConnect(startFeed);
      })
    }
  }

  function startFeed () {
    for (let guildIndex in guildList) {
      let guildId = guildList[guildIndex].id
      let rssList = guildList[guildIndex].sources
      for (let rssIndex in rssList) {
        if (configChecks.checkExists(guildId, rssIndex, false) && configChecks.validChannel(bot, guildId, rssIndex) !== false) {
          getRSS(con, configChecks.validChannel(bot, guildId, rssIndex), rssIndex, false, function () {
            feedsProcessed++
            //console.log(`${feedsProcessed} ${feedsSkipped} (${feedsProcessed + feedsSkipped}) ${feedLength}`)
            if (feedsProcessed + feedsSkipped == feedLength) setTimeout(endCon, 5000);
          });
        }
        else feedsSkipped++;
      }
    }

    if (feedsSkipped + feedsProcessed == feedLength) return endCon();
  }

  connect()
  setInterval(connect, rssConfig.refreshTimeMinutes*60000)

}
