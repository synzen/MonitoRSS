const configChecks = require('./configCheck.js')
const getFeed = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./updateJSON.js')
const config = require('../config.json')
const fetchInterval = require('./fetchInterval.js')

module.exports = function (bot) {
  fetchInterval.cycleInProgress = false
  var guildList = []
  var feedLength = 0
  var feedsProcessed = 0
  var feedsSkipped = 0
  var con
  var startTime

  function endCon (startingCycle) {
    sqlCmds.end(con, function(err) {
      if (err) throw err;
      fetchInterval.cycleInProgress = false
      if (!startingCycle) {
        var timeTaken = ((new Date() - startTime) / 1000).toFixed(2);
        console.log(`RSS Info: Finished feed retrieval cycle. Cycle Time: ${timeTaken}s`);
      }
      else connect();
    }, startingCycle);
  }

  function connect () {
    if (fetchInterval.cycleInProgress) {
      console.log(`RSS Info: Previous cycle was unable to finish. Forcing cycle end and starting new cycle.`);
      endCon(true);
    }
    else {
      fetchInterval.cycleInProgress = true;
      feedLength = feedsProcessed = feedsSkipped = 0;
      guildList = [];
      fileOps.readDir('./sources', function (err, files) {
        if (err) throw err;
        files.forEach(function(guildRSS) {
          let guildId = guildRSS.replace(/.json/g, "")
          if (bot.guilds.get(guildId)) {
            if (fileOps.isEmptySources(guildId)) return console.log(`RSS Info: (${guildId}) => 0 sources found, skipping.`);
            try {
              let guild = require(`../sources/${guildRSS}`)
              guildList.push(guild)
              for (var y in guild.sources) feedLength++;
            }
            catch (err) {fileOps.checkBackup(guildRSS)}
          }
          else if (guildRSS !== "guild_id_here.json" && guildRSS !== "backup") console.log(`RSS Guild Profile: ${guildRSS} was not found in bot's guild list. Skipping.`);
        })
        if (feedLength == 0) {
          fetchInterval.cycleInProgress = false;
          return console.log(`RSS Info: Finished feed retrieval cycle. No feeds to retrieve.`);
        }
        else con = sqlConnect(startRetrieval);
      })
    }
  }

  function startRetrieval () {
    startTime = new Date()
    for (let guildIndex in guildList) {
      let guildId = guildList[guildIndex].id
      let rssList = guildList[guildIndex].sources
      for (let rssIndex in rssList) {
        if (configChecks.checkExists(guildId, rssIndex, false) && configChecks.validChannel(bot, guildId, rssIndex) !== false) {
          getFeed(con, configChecks.validChannel(bot, guildId, rssIndex), rssIndex, false, function () {
            feedsProcessed++
            //console.log(`${feedsProcessed} ${feedsSkipped} ${feedLength}`)
            if (feedsProcessed + feedsSkipped == feedLength) setTimeout(endCon, 5000);
          });
        }
        else feedsSkipped++;
      }
    }
    if (feedsSkipped + feedsProcessed == feedLength) return endCon();
  }

  connect()
  fetchInterval.startSchedule(connect)
}
