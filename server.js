const Discord = require('discord.js')
const bot = new Discord.Client()
const eventHandler = (evnt) => require(`./events/${evnt}.js`)
const configChecks = require('./util/configCheck.js')
const initializeAllRSS = require('./rss/initializeall.js')
const startFeedSchedule = require('./util/startFeedSchedule.js')
const rssConfig = require('./config.json')
const sqlCmds = require('./rss/sql/commands.js')
const sqlConnect = require('./rss/sql/connect.js')
const fs = require('fs')

var guildList = []
var skippedFeeds = 0
var initializedFeeds = 0
var totalFeeds = 0


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
  for (var guildIndex in guildList) {
    let guildId = guildList[guildIndex].id
    let rssList = guildList[guildIndex].sources
    for (var rssIndex in rssList){
      if (configChecks.checkExists(guildId, rssIndex, true, true) && configChecks.validChannel(bot, guildId, rssIndex) !== false) {
        initializeAllRSS(con, configChecks.validChannel(bot, guildId, rssIndex), rssIndex, function() {
          initializedFeeds++;
          if (initializedFeeds + skippedFeeds == totalFeeds) endCon();
        });
      }
      else skippedFeeds++;
    }
  }
  if (skippedFeeds == totalFeeds) endCon();
}


bot.on('ready', function() {
  console.log("I am online.")
  fs.readdir('./sources', function(err, files) {
    if (err) throw err;
    files.forEach(function(guildRSS) {
      let guild = require(`./sources/${guildRSS}`)
      guildList.push(guild)
      for (var y in guild.sources) totalFeeds++
    })
    if (totalFeeds == 0) {
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
