const fs = require('fs')
const configChecks = require('./configCheck.js')
const getFeed = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./fileOps.js')
const config = require('../config.json')
const fetchInterval = require('./fetchInterval.js')
const currentGuilds = fetchInterval.currentGuilds // Main directory of guild profiles (object)
const changedGuilds = fetchInterval.changedGuilds // Directory of changed guilds profiles sent from child process (object)
const deletedGuilds = fetchInterval.deletedGuilds // Directory of deleted guild IDs (array)

module.exports = function(bot) {
  let totalFeeds = 0
  let feedsProcessed = 0
  let feedsSkipped = 0
  let con
  let startTime

  function checkGuildChanges() { // Check for any guilds profiles waiting to be updated

    for (var index in deletedGuilds) { // Get rid of deleted guild profiles
      const guildId = deletedGuilds[index];
      if (currentGuilds.has(guildId)) {
        currentGuilds.delete(guildId);
        console.log(`RSS Module deleted profile for guild ID: ${guildId}`);
      }
      deletedGuilds.splice(index, 1);
      if (changedGuilds.get(guildId)) delete changedGuilds.delete(guildId); // Changed profile is useless now that the guild is deleted
    }

    changedGuilds.forEach(function(guildRss, guildId) { // Check for guilds to be updated that were sent from child process
      currentGuilds.set(guildId, guildRss)
      changedGuilds.delete(guildId)
      console.log('RSS Module updated profile for guild ID: ' + guildId)
    })

  }

function genGuildList(guildFile) {

  const guildId = guildFile.replace(/.json/g, '') // Remove .json file ending since only the ID is needed

  if (!bot.guilds.get(guildId)) { // Check if it is a valid guild in bot's guild collection
     if (guildFile === 'master.json' || guildFile === 'guild_id_here.json' || guildFile === 'backup') return;
     return console.log(`RSS Guild Profile: ${guildFile} was not found in bot's guild list. Skipping.`);
   }

  try {
    const guildRss = JSON.parse(fs.readFileSync(`./sources/${guildFile}`))
    if (fileOps.isEmptySources(guildRss)) return; // Skip when empty source object
    if (!currentGuilds.has(guildId) || JSON.stringify(currentGuilds.get(guildId)) !== JSON.stringify(guildRss)) currentGuilds.set(guildId, guildRss);
    for (var y in guildRss.sources) totalFeeds++; // Count how many feeds there will be in total
  }
  catch(err) {return fileOps.checkBackup(err, guildId)}

}


  function connect() {

    if (fetchInterval.cycleInProgress) {
      console.log(`RSS Info: Previous cycle was unable to finish. Starting new cycle using unclosed connection.`);
      return endCon(true);
    }

    checkGuildChanges()
    fetchInterval.cycleInProgress = true
    totalFeeds = feedsProcessed = feedsSkipped = 0

    currentGuilds.forEach(function(guildRss, guildId) { // key is the guild ID, value is the guildRss
      let rssList = guildRss.sources
      for (var rssName in rssList) totalFeeds++;
    })

    if (totalFeeds === 0) {
      fetchInterval.cycleInProgress = false;
      return console.log(`RSS Info: Finished feed retrieval cycle. No feeds to retrieve.`);
    }
    con = sqlConnect(startRetrieval);
  }

  function startRetrieval() {
    startTime = new Date()
    currentGuilds.forEach(function(guildRss, guildId) {
      const guildName = guildRss.name;
      const rssList = guildRss.sources;
      for (let rssName in rssList) {
        const channel = configChecks.validChannel(bot, guildId, rssList[rssName]);
        if (configChecks.checkExists(guildId, rssList[rssName], false) && channel) { // Check valid source config and channel
          getFeed(con, channel, rssName, false, function (err) {
            if (err) console.log(`RSS Error: (${guildId}, ${guildName}) => Skipping ${err.feed.link}. (${err.content})`);
            feedsProcessed++
            //console.log(`${feedsProcessed} ${feedsSkipped} ${totalFeeds}`)
            if (feedsProcessed + feedsSkipped == totalFeeds) setTimeout(endCon, 5000); // End SQL connection once all feeds have been processed
          });
        }
        else feedsSkipped++;
      }
    })
    if (feedsSkipped + feedsProcessed === totalFeeds) return endCon();
  }

  function endCon(startingCycle) {
    sqlCmds.end(con, function(err) { // End SQL connection
      if (err) console.log('Error: Could not close MySQL connection. ' + err)
      fetchInterval.cycleInProgress = false
      if (startingCycle) return connect();
      var timeTaken = ((new Date() - startTime) / 1000).toFixed(2)
      console.log(`RSS Info: Finished feed retrieval cycle. Cycle Time: ${timeTaken}s`)
    }, startingCycle);
  }

  fetchInterval.startSchedule(connect)
}
