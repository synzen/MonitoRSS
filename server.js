const Discord = require('discord.js')
const bot = new Discord.Client()
const initializeAllRSS = require('./rss/initializeall.js')
const checkValidConfig = require('./util/configCheck.js')
const startFeedSchedule = require('./util/startFeedSchedule.js')
const eventHandler = (evnt) => require(`./events/${evnt}.js`)
var rssConfig = require('./config.json')
const sqlCmds = require('./rss/sql/commands.js')
const sqlConnect = require('./rss/sql/connect.js')
const fs = require('fs')

var skippedFeeds = 0
var initializedFeeds = 0

var rssList = []

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

  var con;

  function endCon() {
    sqlCmds.end(con, function(err) {
      console.log("RSS Info: Finished initialization cycle.")
    });
    startFeedSchedule(bot);
  }

  function start() {
    console.log("RSS Info: Starting initialization cycle.")
    con = sqlConnect(startBot);
    if (con == null) throw "RSS Error: SQL type is not correctly defined in config";
  }

  function startBot() {
    for (var rssIndex in rssList){
      if (checkValidConfig(rssList, rssIndex, true, true)) {
        if (validChannel(rssList, rssIndex) !== false) {
          initializeAllRSS(con, validChannel(rssList, rssIndex), rssList, rssIndex, function() {
            initializedFeeds++;
            if (initializedFeeds + skippedFeeds == rssList.length) endCon();
          });
        }
        else skippedFeeds++;
      }
      else skippedFeeds++;
    }

    if (skippedFeeds == rssList.length) endCon();
  }


bot.on('ready', function() {
  console.log("I am online.")

  fs.readdir('./sources', function(err, files) {
    if (err) throw err;
    files.forEach(function(guildRSS) {
      var guildRssList = require(`./sources/${guildRSS}`).sources
      for (var x in guildRssList) {
        rssList.push(guildRssList[x])
      }
    })
    if (rssList.length == 0) {
      console.log("RSS Info: There are no active feeds.");
      startFeedSchedule(bot);
    }
    else start();
  })



})

bot.on('message', function (message) {
  eventHandler('message')(bot, message)
});

bot.on('guildCreate', function (guild) {
  eventHandler('guildCreate')(bot, guild)
})
bot.on('guildDelete', function (guild) {
  eventHandler('guildDelete')(bot, guild)
})
bot.on('channelDelete', function (channel) {
  eventHandler('channelDelete')(channel)
})


bot.login(rssConfig.token)
