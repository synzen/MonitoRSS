const configChecks = require('./configCheck.js')
const getRSS = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./updateJSON.js')
const config = require('../config.json')

module.exports = function (bot) {
  var config = require('../config.json')

  var cycleInProgress = false
  var guildList = []
  var feedLength = 0
  var feedsProcessed = 0
  var feedsSkipped = 0

  var con

  var startTime


  function endCon (startingCycle) {
    sqlCmds.end(con, function(err) {
      if (err) console.log(err);
      if (!startingCycle) {
        var timeTaken = ((new Date() - startTime) / 1000).toFixed(2);
        console.log(`RSS Info: Finished feed retrieval cycle. Cycle Time: ${timeTaken}s`);
      }
    });
    cycleInProgress = false
    if (startingCycle) setTimeout(connect, 5000);
  }

  function connect () {
    if (cycleInProgress) {
      console.log(`RSS Info: Previous cycle was unable to finish. Forcing cycle end and starting new cycle.`);
      endCon(true);
    }
    else {
      cycleInProgress = true;
      feedLength = feedsProcessed = feedsSkipped = 0;
      guildList = [];
      fileOps.readDir('./sources', function (err, files) {
        if (err) throw err;
        files.forEach(function(guildRSS) {
          if (bot.guilds.get(guildRSS.replace(/.json/g, "")) != null) {
            try {
              let guild = require(`../sources/${guildRSS}`)
              guildList.push(guild);
              for (var y in guild.sources) feedLength++;
            }
            catch (err) {fileOps.checkBackup(guildRSS)}
          }
          else if (guildRSS !== "guild_id_here.json" && guildRSS !== "backup") console.log(`RSS Guild Profile: ${guildRSS} was not found in bot's guild list. Skipping.`);
        })
        if (feedLength == 0) {
          cycleInProgress = false;
          return console.log(`RSS Info: Finished feed retrieval cycle. No feeds to retrieve.`);
        }
        else con = sqlConnect(startFeed);
      })
    }
  }

  function startFeed () {
    startTime = new Date()
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
  setInterval(connect, config.refreshTimeMinutes*60000)

}
