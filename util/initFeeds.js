const fs = require('fs')
const initAll = require('../rss/initializeall.js')
const currentGuilds = require('./fetchInterval.js').currentGuilds
const configChecks = require('./configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fileOps = require('./fileOps.js')
const checkGuild = require('./checkGuild.js')

module.exports = function (bot, callback) {
  const guildList = []
  let skippedFeeds = 0
  let initializedFeeds = 0
  let totalFeeds = 0
  let con;

  function addGuildRss(guildFile) {
    const guildId = guildFile.replace(/.json/g, '') // Remove .json file ending since only the ID is needed
    if (!bot.guilds.get(guildId)) { // Check if it is a valid guild in bot's guild collection
       if (guildFile === 'master.json' || guildFile === 'guild_id_here.json' || guildFile === 'backup') return;
       return console.log(`RSS Guild Profile: ${guildFile} was not found in bot's guild list. Skipping.`);
     }

    try {
      const guildRss = JSON.parse(fs.readFileSync(`./sources/${guildFile}`))
      if (fileOps.isEmptySources(guildRss)) {
        console.log(`${guildId} is EMPTY! Skipping.`);
        return; // Skip when empty source object
      }

      if (!currentGuilds.has(guildId) || JSON.stringify(currentGuilds.get(guildId)) !== JSON.stringify(guildRss)) currentGuilds.set(guildId, guildRss);
      for (var y in guildRss.sources) totalFeeds++; // Count how many feeds there will be in total
    }
    catch(err) {return fileOps.checkBackup(err, guildId)}
  }

  fs.readdir('./sources', function (err, files) {
    if (err) throw err;
    files.forEach(addGuildRss)
    if (totalFeeds === 0) {
      console.log('RSS Info: There are no active feeds to initialize.');
      return callback();
    }
    return connect();
  })

  function connect() {
    console.log('RSS Info: Starting initialization cycle.')
    con = sqlConnect(function(err) {
      if (!err) return initFeeds();
      console.log(`Could not connect to SQL database for initialization. (${err})`)
    })
    if (!con) throw new Error('RSS Error: SQL type is not correctly defined in config');
  }

  function initFeeds() {
    currentGuilds.forEach(function(guildRss, guildId) {
    // for (var guildId in currentGuilds) {
      const guildName = guildRss.name;
      const rssList = guildRss.sources;
      checkGuild.names(bot, guildId); // Check for any guild name changes
      for (var rssName in rssList) {
        checkGuild.roles(bot, guildId, rssName); // Check for any role name changes
        const channel = configChecks.validChannel(bot, guildId, rssList[rssName]);
        if (configChecks.checkExists(guildId, rssList[rssName], true, true) && channel) { // Check valid source config and channel
          initAll(con, channel, rssName, function(err) {
            if (err) console.log(`RSS Error: (${guildId}, ${guildName}) => Skipping ${err.feed.link}. (${err.content})`);
            initializedFeeds++;
            console.log(`${initializedFeeds}, ${totalFeeds}`)
            if (initializedFeeds + skippedFeeds === totalFeeds) endCon(); // End SQL connection once all feeds have been processed
          });
        }
        else skippedFeeds++;
      }
    })
    if (skippedFeeds === totalFeeds) endCon();
  }

  function endCon() {
    sqlCmds.end(con, function(err) {
      console.log('RSS Info: Finished initialization cycle.')
    })
    callback()
  }

}
