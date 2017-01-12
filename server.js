const Discord = require('discord.js')
process.setMaxListeners(0)
const bot = new Discord.Client()
const initializeAllRSS = require('./rss/initializeall.js')
const checkValidConfig = require('./util/configCheck.js')
const rssAdd = require('./commands/addRSS.js')
const rssHelp = require('./commands/helpRSS.js')
const rssPrintList = require('./commands/util/printFeeds.js')
const startFeedSchedule = require('./util/startFeedSchedule.js')
var rssConfig = require('./config.json')
var guildList = rssConfig.sources//[bot.guild.id]
// const sqlCmds = require('./rss/sql/commands.js')
// const updateConfig = require('./util/updateJSON.js')
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
var enabledFeeds = 0

for (let q in guildList)
  for (let x in guildList[q])
    if (guildList[q][x].enabled == 1) enabledFeeds++;

bot.on('ready', function() {
  console.log("I am online.")
  console.log("RSS Info: Starting initialization cycle.")

  var con = sqlConnect(startBot);
  if (con == null) throw "RSS Error: SQL type is not correctly defined in config"

  function startBot() {
    for (var guildIndex in guildList) {
      for (var rssIndex in guildList[guildIndex]){
        if (checkValidConfig(guildIndex, rssIndex, true, true)) {
          if (validChannel(guildIndex, rssIndex) !== false) {
            initializeAllRSS(con, validChannel(guildIndex, rssIndex), rssIndex, function() {
              initializedFeeds++
              if (initializedFeeds == enabledFeeds) {
                sqlCmds.end(con, function(err) {
                  console.log("RSS Info: Finished initialization cycle.")
                });
                startFeedSchedule(bot);
              }
            });
          }
          else if (validChannel(guildIndex, rssIndex) == false) initializedFeeds++;
        }
      }
    }
  }

  if (enabledFeeds == 0) {
    console.log("RSS Info: All feeds are disabled");
    startFeedSchedule(bot);
  }

})

var commands = {
  //rssadd: {description: "Add an RSS feed to the channel with the default message."},
  rssremove: {description: "Open a menu to delete a feed from the channel.", file: "removeRSS"},
  rssmessage: {description: "Open a menu to customize a feed's text message.", file: "customMessage"},
  rssembed: {description: "Open a menu to customzie a feed's embed message. This will replace the normal embed Discord usually sends when a link is posted.", file: "customEmbed"},
  rsstest: {description: "Opens a menu to send a test message for a specific feed, along with the available properties and tags for customization.", file: "testRSS"},
  rssfilteradd: {description: "Opens a menu to add filters.", file: "filterAdd"},
  rssfilterremove: {description: "Opens a menu to remove filters.", file: "filterRemove"}
}


bot.on('message', function (message) {
  if (message.member == null || !message.member.hasPermission("MANAGE_CHANNELS") || message.author.bot ) return;
  var m = message.content.split(" ")
  let command = m[0].substr(rssConfig.prefix.length)

  if (command == "rssadd"){
    rssAdd(bot, message);
  }

  else if (command == "rsshelp") {
    rssHelp(commands, message);
  }
  else if (command == "rsslist") {
    rssPrintList(commands, message, false, "")
  }

  //for commands that needs menu selection, AKA collectors
  for (let cmd in commands) {
    if (command == cmd) {
      inProgress = true;
      rssPrintList(commands, message, true, commands[cmd].file)
    }
  }

});

const update = require('./util/updateJSON.js')
bot.on('guildCreate', function (guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been added.`)
})

const removeRSS = require('./commands/removeRSS.js')
bot.on('channelDelete', function (channel) {
  let rssList = rssConfig.sources[channel.guild.id]
  for (let rssIndex in rssList) {
    if (rssList[rssIndex].channel == channel.id) {
      removeRSS(commands, channel, rssIndex)
    }
  }

})

bot.on('guildDelete', function (guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been removed.`)

  for (let rssIndex in rssConfig.sources[guild.id]) {
    sqlCmds.dropTable(rssConfig.databaseName, rssConfig.sources[guild.id][rssIndex])
  }

  delete rssConfig.sources[guild.id]
  update('./config.json', rssConfig)
})

bot.login(rssConfig.token)
