var rssConfig = require('../config.json')
const rssAdd = require('../commands/addRSS.js')
const rssHelp = require('../commands/helpRSS.js')
const printFeeds = require('../commands/util/printFeeds.js')
const rssRoles = require('../commands/rssRoles.js')
const checkPerm = require('../util/checkPerm.js')
const rssTimezone = require('../commands/timezone.js')
const commandList = require('../util/commandList.json')

module.exports = function (bot, message) {
  if (message.member == null || !message.member.hasPermission("MANAGE_CHANNELS") || message.author.bot) return;
  var m = message.content.split(" ")
  let command = m[0].substr(rssConfig.prefix.length)

  function logCommand(command) {
    return console.log(`(${message.guild.id}, ${message.guild.name}) => Used ${command}.`)
  }

  //ugly permission checking, but it'll have to do for now

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
    printFeeds(bot, message, false, "")
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
      logCommand(command);
      printFeeds(bot, message, true, cmd);
    }
  }

}
