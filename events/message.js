const config = require('../config.json')
const rssAdd = require('../commands/rssAdd.js')
const rssHelp = require('../commands/rssHelp.js')
const printFeeds = require('../commands/util/printFeeds.js')
const rssRoles = require('../commands/rssRoles.js')
const checkPerm = require('../util/checkPerm.js')
const rssTimezone = require('../commands/rssTimezone.js')
const commandList = require('../util/commandList.json')
const channelTracker = require('../util/channelTracker.js')

module.exports = function (bot, message) {
  if (message.member == null || !message.member.hasPermission("MANAGE_CHANNELS") || message.author.bot) return;
  var m = message.content.split(" ")
  let command = m[0].substr(config.prefix.length)

  function logCommand(command) {
    return console.log(`RSS Commands: (${message.guild.id}, ${message.guild.name}) => Used ${command}.`)
  }

  //ugly permission checking, but it'll have to do for now
  if (channelTracker.hasActiveMenus(message.channel.id)) return;

  if (command == "rssadd" && checkPerm(command, bot, message.channel)){
    logCommand(command);
    rssAdd(bot, message);
  }
  else if (command == "rsshelp" && checkPerm(command, bot, message.channel)) {
    logCommand(command);
    rssHelp(message, commandList);
  }
  else if (command == "rsslist" && checkPerm(command, bot, message.channel)) {
    logCommand(command);
    printFeeds(bot, message, false, "");
  }
  else if (command == "rsstimezone" && checkPerm(command, bot, message.channel)) {
    logCommand(command);
    rssTimezone(message);
  }
  else if (command == "rssroles") {
    logCommand(command);
    rssRoles(bot, message, command);
  }

  //for commands that needs menu selection, AKA collectors
  else for (let cmd in commandList) {
    if (command == cmd && checkPerm(command, bot, message.channel)) {
      logCommand(command)
      printFeeds(bot, message, true, cmd)//commandList[cmd].file)
    }
  }

}
