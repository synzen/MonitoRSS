const initAll = require('../rss/initializeall.js')
const configChecks = require('./configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./fileOps.js')
const checkGuild = require('./checkGuild.js')

module.exports = function (bot, callback) {
  var guildList = []
  var skippedFeeds = 0
  var initializedFeeds = 0
  var totalFeeds = 0
  var con;

  function endCon () {
    sqlCmds.end(con, function(err) {
      console.log('RSS Info: Finished initialization cycle.')
    })
    callback()
  }

  function start () {
    // Connect to the SQL database
    console.log('RSS Info: Starting initialization cycle.')
    con = sqlConnect(initFeeds)
    if (!con) throw 'RSS Error: SQL type is not correctly defined in config';
  }

  function initFeeds () {
    for (var guildIndex in guildList) {
      var guildName = guildList[guildIndex].name;
      var guildId = guildList[guildIndex].id;
      var rssList = guildList[guildIndex].sources;
      checkGuild.names(bot, guildId); // Check for any guild name changes
      for (var rssName in rssList){
        checkGuild.roles(bot, guildId, rssName); // Check for any role name changes
        if (configChecks.checkExists(guildId, rssName, true, true) && configChecks.validChannel(bot, guildId, rssName)) { // Check valid source config and channel
          initAll(con, configChecks.validChannel(bot, guildId, rssName), rssName, function(err) {
            if (err) console.log(`RSS Error: (${guildId}, ${guildName}) => Skipping ${rssList[rssName].link}. Reason: ${err.content}`);
            initializedFeeds++;
            console.log(`${initializedFeeds}, ${totalFeeds}`)
            if (initializedFeeds + skippedFeeds === totalFeeds) endCon(); // End SQL connection once all feeds have been processed
          });
        }
        else skippedFeeds++;
      }
    }
    if (skippedFeeds === totalFeeds) endCon();
  }

  fileOps.readDir('./sources', function (err, files) {
    if (err) throw err;
    files.forEach(function(guildRss) {
      let guildId = guildRss.replace(/.json/g, '') // Remove .json file ending since only the ID is needed
      if (bot.guilds.get(guildId)) { // Check if it is a valid guild in bot's guild collection
        if (fileOps.isEmptySources(guildId)) return console.log(`RSS Info: (${guildId}) => 0 sources found, skipping.`);
        // Enclosed in a try/catch to account for invalid JSON
        try {
          let guild = require(`../sources/${guildRss}`)
          guildList.push(guild)
          for (var y in guild.sources) totalFeeds++; // Count how many feeds there will be in total
        }
        catch (err) {fileOps.checkBackup(guildRss)}
      }
      else if (guildRss !== 'guild_id_here.json' && guildRss !== 'backup'){
        console.log(`RSS Guild Profile: ${guildRss} was not found in bot's guild list. Skipping.`);
      }
    })
    if (totalFeeds === 0) {
      console.log('RSS Info: There are no active feeds.');
      callback();
    }
    else return start();
  })


}
