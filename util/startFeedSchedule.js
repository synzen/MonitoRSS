const configChecks = require('./configCheck.js')
const getFeed = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./fileOps.js')
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

  function checkGuildUpdates() {
    // Check for guilds to be updated that were sent from child process
    for (var guildId in fetchInterval.changedGuilds) {
      try {
        delete require.cache[require.resolve(`../sources/${guildId}.json`)]
        console.log('RSS Module deleted cache for profile of guild ID: ' + guildId)
        delete fetchInterval.changedGuilds[guildId]
      } catch (e) {}
    }
  }

  function endCon(startingCycle) {
    // End SQL connection
    sqlCmds.end(con, function(err) {
      if (err) console.log('Error: Could not close MySQL connection. ' + err)
      fetchInterval.cycleInProgress = false
      if (startingCycle) return connect();
      var timeTaken = ((new Date() - startTime) / 1000).toFixed(2)
      console.log(`RSS Info: Finished feed retrieval cycle. Cycle Time: ${timeTaken}s`)
    }, startingCycle);
  }

  function connect() {
    if (fetchInterval.cycleInProgress) {
      console.log(`RSS Info: Previous cycle was unable to finish. Starting new cycle using unclosed connection.`);
      return endCon(true);
    }
    checkGuildUpdates()
    fetchInterval.cycleInProgress = true
    feedLength = feedsProcessed = feedsSkipped = 0
    guildList = []
    fileOps.readDir('./sources', function (err, files) {
      if (err) throw err;
      files.forEach(function(guildRSS) {
        let guildId = guildRSS.replace(/.json/g, '') // Remove .json file ending since only the ID is needed
        if (bot.guilds.get(guildId)) {   // Check if it is a valid guild in bot's guild collection
          if (fileOps.isEmptySources(guildId)) return console.log(`RSS Info: (${guildId}) => 0 sources found, skipping.`);
          // Enclosed in a try/catch to account for invalid JSON
          try {
            let guild = require(`../sources/${guildRSS}`)
            guildList.push(guild)
            for (var y in guild.sources) feedLength++; // Count how many feeds there will be in total
          }
          catch (err) {fileOps.checkBackup(guildRSS)}
        }
        else if (guildRSS !== 'guild_id_here.json' && guildRSS !== 'backup') console.log(`RSS Guild Profile: ${guildRSS} was not found in bot's guild list. Skipping.`);
      })
      if (feedLength == 0) {
        fetchInterval.cycleInProgress = false;
        return console.log(`RSS Info: Finished feed retrieval cycle. No feeds to retrieve.`);
      }
      con = sqlConnect(startRetrieval);
    })

  }

  function startRetrieval() {
    startTime = new Date()
    for (let guildIndex in guildList) {
      let guildName = guildList[guildIndex].name;
      let guildId = guildList[guildIndex].id;
      let rssList = guildList[guildIndex].sources;
      for (let rssName in rssList) {
        if (configChecks.checkExists(guildId, rssName, false) && configChecks.validChannel(bot, guildId, rssName)) { // Check valid source config and channel
          getFeed(con, configChecks.validChannel(bot, guildId, rssName), rssName, false, function (err) {
            if (err) console.log(`RSS Error: (${guildId}, ${guildName}) => ${err.toString().slice(7, err.toString().length)} for ${rssList[rssName].link}, skipping...`);
            feedsProcessed++
            //console.log(`${feedsProcessed} ${feedsSkipped} ${feedLength}`)
            if (feedsProcessed + feedsSkipped == feedLength) setTimeout(endCon, 5000); // End SQL connection once all feeds have been processed
          });
        }
        else feedsSkipped++;
      }
    }
    if (feedsSkipped + feedsProcessed == feedLength) return endCon();
  }

  fetchInterval.startSchedule(connect)
}
