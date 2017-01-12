process.setMaxListeners(0)
const Discord = require('discord.js')
const bot = new Discord.Client()
const initializeAllRSS = require('./rss/initializeall.js')
const checkValidConfig = require('./util/configCheck.js')
const rssAdd = require('./commands/addRSS.js')
const rssHelp = require('./commands/helpRSS.js')
const rssPrintList = require('./commands/util/printFeeds.js')
const startFeedSchedule = require('./util/startFeedSchedule.js')
var rssConfig = require('./config.json')
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

var initializedFeeds = 0
var enabledFeeds = 0

for (let q in guildList)
  for (let x in guildList[q])
    if (guildList[q][x].enabled == 1) enabledFeeds++;

bot.on('ready', function() {
  console.log("I am online.")

  for (var guildIndex in guildList) {
    for (var rssIndex in guildList[guildIndex]){
      if (checkValidConfig(guildIndex, rssIndex, true, true)) {
        if (validChannel(guildIndex, rssIndex) !== false) {
          initializeAllRSS(bot, validChannel(guildIndex, rssIndex), rssIndex, function() {
            initializedFeeds++
            if (initializedFeeds == enabledFeeds) {
              startFeedSchedule(bot);
            }
          });
        }
        else if (validChannel(guildIndex, rssIndex) == false) initializedFeeds++;
      }
    }
  }

  if (enabledFeeds == 0) {
    console.log("RSS Info: All feeds are disabled");
    startFeedSchedule(bot);
  }

})

var commands = {
  rssadd: {description: "Add an RSS feed to the channel with the default message."},
  rssremove: {description: "Open a menu to delete a feed from the channel.", file: "removeRSS"},
  rssmessage: {description: "Open a menu to customize a feed's text message.", file: "customMessage"},
  rssembed: {description: "Open a menu to customzie a feed's embed message. This will replace the normal embed Discord usually sends when a link is posted.", file: "customEmbed"},
  rsstest: {description: "Opens a menu to send a test message for a specific feed, along with the available properties and tags for customization.", file: "testRSS"},
  rssfilteradd: {description: "Opens a menu to add filters.", file: "filterAdd"},
  rssfilterremove: {description: "Opens a menu to remove filters.", file: "filterRemove"}
}

var inProgress = false;
bot.on('message', function (message) {
  if (message.member == null || !message.member.hasPermission("MANAGE_CHANNELS") || message.author.bot ) return;
  var m = message.content.split(" ")
  let command = m[0].substr(rssConfig.prefix.length)

  if (command == "rssadd" && !inProgress){
    rssAdd(bot, message);
  }

  else if (command == "printlisten") {
    message.channel.sendMessage(process.getMaxListeners())
  }

  else if (command == "rsshelp" && !inProgress) {
    rssHelp(commands, message);
  }
  else if (command == "rsslist" && !inProgress) {
    rssPrintList(message, false, "", function (){})
  }
  else if (command == "stats" && message.author.id == "156576312985780224") {
    message.channel.sendMessage(`Guilds: ${bot.guilds.size}\nUsers: ${bot.users.size}\nChannels: ${bot.channels.size}`)
  }
  else if (command == "setgame" && message.author.id == "156576312985780224"){
    let a = message.content.split(" ")
    a.shift()
    let game = a.join(" ")
    if (game == "null") game = null;
    bot.user.setGame(game)
  }

  //for commands that needs menu selection, AKA collectors
  else if (!inProgress) {
    for (let cmd in commands) {
      if (command == cmd) {
        inProgress = true;
        rssPrintList(message, true, commands[cmd].file, function () {
          inProgress = false
        })
      }
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
      removeRSS(channel, rssIndex, function (){})
    }
  }

})

const sqlCmds = require('./rss/sql/commands.js')
bot.on('guildDelete', function (guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been removed.`)

  for (let rssIndex in rssConfig.sources[guild.id]) {
    sqlCmds.dropTable(rssConfig.databaseName, rssConfig.sources[guild.id][rssIndex])
  }

  delete rssConfig.sources[guild.id]
  update('./config.json', rssConfig)
})

bot.login(rssConfig.token)
