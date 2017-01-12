const checkValidConfig = require('./configCheck.js')
const getRSS = require('../rss/rss.js')
var rssConfig = require('../config.json')
var guildList = rssConfig.sources
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')

module.exports = function (bot, feedIndex) {
  var rssConfig = require('../config.json')
  var guildList = rssConfig.sources

  function validChannel(guildIndex, rssIndex) {
    if (isNaN(parseInt(guildList[guildIndex][rssIndex].channel,10))) {
      let channel = bot.channels.find("name",guildList[guildIndex][rssIndex].channel);
      if (channel == null) {
        console.log(`RSS Warning: ${guildList[guildIndex][rssIndex].name}'s string-defined channel was not found, skipping...`)
        return false;
      }
      else return channel;
    }
    else {
      let channel = bot.channels.get(`${guildList[guildIndex][rssIndex].channel}`);
      if (channel == null) {
        console.log(`RSS Warning: ${guildList[guildIndex][rssIndex].name}'s integer-defined channel was not found. skipping...`)
        return false;
      }
      else return channel;
    }
  }

var feedLength = 0
var feedProcessed = 0

for (let x in guildList)
  for (let y in guildList[x])
    feedLength++

var con;

  function connect () {
    con = sqlConnect(startFeed)
  }

  function startFeed () {
    console.log("RSS Info: Starting feed retrieval cycle.")
    rssConfig = require('../config.json')
    rssList = rssConfig.sources
    for (let guildIndex in guildList)
      for (let rssIndex in guildList[guildIndex])
        if (checkValidConfig(guildIndex, rssIndex, false))
          if (validChannel(guildIndex, rssIndex) !== false)
            getRSS(con, rssIndex , validChannel(guildIndex, rssIndex), false, function () {
              feedProcessed++
              if (feedProcessed == feedLength) {
                feedProcessed = 0;
                sqlCmds.end(con, function(err) {
                  console.log("RSS Info: Finished feed retrieval cycle.")
                });
              }
            });
  }

  connect()
  setInterval(connect, rssConfig.refreshTimeMinutes*60000)

}
