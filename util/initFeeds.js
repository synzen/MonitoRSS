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
    console.log('RSS Info: Starting initialization cycle.')
    con = sqlConnect(initFeeds)
    if (!con) throw 'RSS Error: SQL type is not correctly defined in config';
  }

  function initFeeds () {
    for (var guildIndex in guildList) {
      var guildName = guildList[guildIndex].name;
      var guildId = guildList[guildIndex].id;
      var rssList = guildList[guildIndex].sources;
      checkGuild.names(bot, guildId);
      for (var rssName in rssList){
        checkGuild.roles(bot, guildId, rssName);
        if (configChecks.checkExists(guildId, rssName, true, true) && configChecks.validChannel(bot, guildId, rssName)) {
          initAll(con, configChecks.validChannel(bot, guildId, rssName), rssName, function(err) {
            if (err) {
              if (!rssList[rssName]) {
                console.info(guildId + '\n\n')
                console.info(rssList + '\n\n');
                console.info(rssName);
              }
              console.log(`RSS Error: (${guildId}, ${guildName}) => ${err.toString().slice(7, err.toString().length)} for ${rssList[rssName].link}, skipping...`);
            }
            initializedFeeds++;
            console.log(`${initializedFeeds}, ${totalFeeds}`)
            if (initializedFeeds + skippedFeeds === totalFeeds) endCon();
          });
        }
        else skippedFeeds++;
      }
    }
    if (skippedFeeds == totalFeeds) endCon();
  }

  fileOps.readDir('./sources', function (err, files) {
    if (err) throw err;
    files.forEach(function(guildRss) {
      let guildId = guildRss.replace(/.json/g, '')
      if (bot.guilds.get(guildId)) {
        if (fileOps.isEmptySources(guildId)) return console.log(`RSS Info: (${guildId}) => 0 sources found, skipping.`);
        try {
          let guild = require(`../sources/${guildRss}`)
          guildList.push(guild)
          for (var y in guild.sources) totalFeeds++;
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
