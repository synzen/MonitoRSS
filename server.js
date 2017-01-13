const Discord = require('discord.js')
const bot = new Discord.Client()
const initializeAllRSS = require('./rss/initializeall.js')
const checkValidConfig = require('./util/configCheck.js')
const startFeedSchedule = require('./util/startFeedSchedule.js')
const eventHandler = (evnt) => require(`./events/${evnt}.js`)
var rssConfig = require('./config.json')
var guildList = rssConfig.sources

const sqlCmds = require('./rss/sql/commands.js')
const sqlConnect = require('./rss/sql/connect.js')

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

var initializedFeeds = 0
var totalFeeds = 0

for (let q in guildList)
  for (let x in guildList[q])
    totalFeeds++;

  var con;

  function start() {
    con = sqlConnect(startBot);
    if (con == null) throw "RSS Error: SQL type is not correctly defined in config";
  }

  function startBot() {
    for (var guildIndex in guildList) {
      for (var rssIndex in guildList[guildIndex]){
        if (checkValidConfig(guildIndex, rssIndex, true, true)) {
          if (validChannel(guildIndex, rssIndex) !== false) {
            initializeAllRSS(con, validChannel(guildIndex, rssIndex), rssIndex, function() {
              initializedFeeds++;
              if (initializedFeeds == totalFeeds) {
                sqlCmds.end(con, function(err) {
                  console.log("RSS Info: Finished initialization cycle.")
                });
                startFeedSchedule(bot);
              }
            });
          }
          else initializedFeeds++;
        }
        else initializedFeeds++;
      }
    }
  }


bot.on('ready', function() {
  console.log("I am online.")
  console.log("RSS Info: Starting initialization cycle.")

  start()

  if (totalFeeds == 0) {
    console.log("RSS Info: All feeds are disabled");
    startFeedSchedule(bot);
  }

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
