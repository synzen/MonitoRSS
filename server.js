const Discord = require('discord.js')
const bot = new Discord.Client()
const initializeAllRSS = require('./rss/initializeall.js')
const checkValidConfig = require('./util/configCheck.js')
const rssAdd = require('./commands/addRSS.js')
const rssPrintList = require('./commands/util/printFeeds.js')


const startFeedSchedule = require('./util/startFeedSchedule.js')
var rssConfig = require('./config.json')
var rssList = rssConfig.sources

var initializedFeeds = 0
var enabledFeeds = 0

for (var x in rssList)
  if (rssList[x].enabled == 1) enabledFeeds++;

function validChannel(rssIndex) {
  if (isNaN(parseInt(rssList[rssIndex].channel,10))) {
    let channel = bot.channels.find("name",rssList[rssIndex].channel);
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

bot.on('ready', function() {
  console.log("I am online.")

  for (var rssIndex in rssList){
    if (checkValidConfig(rssIndex, true, true)) {
      if (validChannel(rssIndex) !== false) {
        initializeAllRSS(bot, validChannel(rssIndex), rssIndex, function() {
          initializedFeeds++
          if (initializedFeeds == enabledFeeds) startFeedSchedule(bot);
        });
      }
    }
  }

  if (enabledFeeds == 0 || rssList.length == 0) {
    console.log("RSS Info: All feeds are disabled");
    startFeedSchedule(bot);
  }

})

var inProgress = false;
bot.on('message', function (message) {
  if (!message.member.hasPermission("MANAGE_CHANNELS") || message.author.bot) return;
  
  let m = message.content.split(" ")
  let command = m[0].substr(rssConfig.prefix.length)

  if (command == "rssadd" && !inProgress){
    rssAdd(bot, message);
  }

  else if (command == "rsstest" && !inProgress) {
    inProgress = true;
    rssPrintList(message, 'testRSS', function() {
      inProgress = false
    })
  }

  else if (command == "rssremove" && !inProgress){
    inProgress = true;
    rssPrintList(message, 'removeRSS', function() {
      inProgress = false
    })
  }

  else if (command == "rssmessage" && !inProgress) {
    inProgress = true;
    rssPrintList(message, 'customMessage', function() {
      inProgress = false
    })
  }

  else if (command == "rssembed" && !inProgress) {
    inProgress = true;
    rssPrintList(message, 'customEmbed', function() {
      inProgress = false
    })
  }

});

bot.login(rssConfig.token)
