const configChecks = require('./configCheck.js')
const getRSS = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fs = require('fs')
const rssConfig = require('../config.json')

module.exports = function (bot) {
  var rssConfig = require('../config.json')

  var guildList = []
  var feedLength = 0
  var feedsProcessed = 0
  var feedsSkipped = 0

  var con

  function endCon () {
    sqlCmds.end(con, function(err) {
      console.log("RSS Info: Finished feed retrieval cycle. " + new Date())
    });
  }

  function connect () {
    //console.log("RSS Info: Starting feed retrieval cycle.")
    feedLength = feedsProcessed = feedsSkipped = 0
    guildList = []
    fs.readdir('./sources', function(err, files) {
      if (err) throw err;
      files.forEach(function(guildRSS) {
        let guild = require(`../sources/${guildRSS}`)
        guildList.push(guild)
        for (var y in guild.sources) feedLength++
      })
      if (feedLength == 0) return console.log("RSS Info: Finished feed retrieval cycle. No feeds to retrieve. " + new Date());
      else con = sqlConnect(startFeed);
    })

  }

  function startFeed () {
    for (let guildIndex in guildList) {
      let guildId = guildList[guildIndex].id
      let rssList = guildList[guildIndex].sources
      for (let rssIndex in rssList) {
        if (configChecks.checkExists(guildId, rssIndex, false) && configChecks.validChannel(bot, guildId, rssIndex) !== false) {
          getRSS(con, guildId, rssIndex , configChecks.validChannel(bot, guildId, rssIndex), false, function () {
            feedsProcessed++
            //console.log(feedsProcessed + feedsSkipped + " " + feedLength)
            if (feedsProcessed + feedsSkipped == feedLength) endCon();
          });
        }
        else feedsSkipped++;
      }
    }

    if (feedsSkipped + feedsProcessed == feedLength) endCon();
  }

  connect()
  setInterval(connect, rssConfig.refreshTimeMinutes*60000)

}
