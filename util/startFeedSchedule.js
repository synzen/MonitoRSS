const checkValidConfig = require('./configCheck.js')
const getRSS = require('../rss/rss.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')
const fs = require('fs')
var rssConfig = require('../config.json')

module.exports = function (bot) {
  var rssConfig = require('../config.json')

  function validChannel(rssList, rssIndex) {
    if (isNaN(parseInt(rssList[rssIndex].channel,10))) {
      let channel = bot.channels.find("name", rssList[rssIndex].channel);
      if (channel == null) {
        console.log(`RSS Warning: ${rssList[rssIndex].name}'s string-defined channel was not found, skipping...`)
        return false;
      }
      else return channel;
    }
    else {
      let channel = bot.channels.get(`${rssList[rssIndex].channel}`);
      if (channel == null) {
        console.log(`RSS Warning: ${rssList[rssIndex].name}'s integer-defined channel was not found. skipping...`)
        return false;
      }
      else return channel;
    }
  }

  var feedLength = 0
  var feedsProcessed = 0
  var feedsSkipped = 0

  var con
  var rssList = []

  function endCon () {
    sqlCmds.end(con, function(err) {
      console.log("RSS Info: Finished feed retrieval cycle.")
    });
  }

  function connect () {
    console.log("RSS Info: Starting feed retrieval cycle.")
    feedsProcessed = 0
    feedsSkipped = 0
    rssList = []
    fs.readdir('./sources', function(err, files) {
      if (err) throw err;
      files.forEach(function(guildRSS) {
        var guildRssList = require(`../sources/${guildRSS}`).sources
        for (var x in guildRssList) {
          rssList.push(guildRssList[x])
        }
      })
      if (rssList.length == 0) return console.log("RSS Info: No feeds to retrieve. Finishing retrieval cycle.");
      else con = sqlConnect(startFeed);
    })

  }

  function startFeed () {

    for (let rssIndex in rssList)
      if (checkValidConfig(rssList, rssIndex, false)) {
        if (validChannel(rssList, rssIndex) !== false) {
          getRSS(con, rssList, rssIndex , validChannel(rssList, rssIndex), false, function () {
            feedsProcessed++
            console.log(feedsProcessed + feedsSkipped + " " + rssList.length)
            if (feedsProcessed + feedsSkipped == rssList.length) {
              endCon();
            }
          });
        }
        else feedsSkipped++;
      }
      else feedsSkipped++;

    if (feedsSkipped + feedsProcessed == rssList.length) endCon();
  }

  connect()
  setInterval(connect, rssConfig.refreshTimeMinutes*60000)

}
