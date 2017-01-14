const checkValidConfig = require('./configCheck.js')
const getRSS = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fs = require('fs')
var rssConfig = require('../config.json')

module.exports = function (bot) {
  var rssConfig = require('../config.json')

  function validChannel(guildId, rssIndex) {
    var guild = require(`../sources/${guildId}.json`)
    var rssList = guild.sources

    if (isNaN(parseInt(rssList[rssIndex].channel,10))) {
      let channel = bot.channels.find("name", rssList[rssIndex].channel);
      if (channel == null) {
        console.log(`RSS Warning: ${guild.id} => ${rssList[rssIndex].name}'s string-defined channel was not found, skipping...`)
        return false;
      }
      else return channel;
    }
    else {
      let channel = bot.channels.get(`${rssList[rssIndex].channel}`);
      if (channel == null) {
        console.log(`RSS Warning: ${guild.id} => ${rssList[rssIndex].name}'s integer-defined channel was not found. skipping...`)
        return false;
      }
      else return channel;
    }
  }

  var feedLength = 0
  var feedsProcessed = 0
  var feedsSkipped = 0

  var con
  var guildList = []

  function endCon () {
    sqlCmds.end(con, function(err) {
      console.log("RSS Info: Finished feed retrieval cycle.")
    });
  }

  function connect () {
    console.log("RSS Info: Starting feed retrieval cycle.")
    feedLength = feedsProcessed = feedsSkipped = 0
    guildList = []
    fs.readdir('./sources', function(err, files) {
      if (err) throw err;
      files.forEach(function(guildRSS) {
        let guild = require(`../sources/${guildRSS}`)
        guildList.push(guild)
        for (var y in guild.sources) feedLength++
      })
      if (feedLength == 0) return console.log("RSS Info: Finished feed retrieval cycle. No feeds to retrieve.");
      else con = sqlConnect(startFeed);
    })

  }

  function startFeed () {
    for (let guildIndex in guildList) {
      let guildId = guildList[guildIndex].id
      let rssList = guildList[guildIndex].sources
      for (let rssIndex in rssList) {
        if (checkValidConfig(guildId, rssIndex, false)) {
          if (validChannel(guildId, rssIndex) !== false) {
            getRSS(con, guildId, rssIndex , validChannel(guildId, rssIndex), false, function () {
              feedsProcessed++
              /console.log(feedsProcessed + feedsSkipped + " " + feedLength)
              if (feedsProcessed + feedsSkipped == feedLength) {
                endCon();
              }
            });
          }
          else feedsSkipped++;
        }
        else feedsSkipped++;
      }
    }

    if (feedsSkipped + feedsProcessed == feedLength) endCon();
  }

  connect()
  setInterval(connect, rssConfig.refreshTimeMinutes*60000)

}
