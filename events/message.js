const config = require('../config.json')
const controllerCmds = require('../commands/controller/controllerCmds.js')
const loadCommand = (file) => require(`../commands/${file}.js`)
const checkPerm = require('../util/checkPerm.js')
const commandList = require('../util/commandList.json')
const channelTracker = require('../util/channelTracker.js')
const blacklistGuilds = require('../util/storage.js').blacklistGuilds

function isBotController (command, author) {
  let controllerList = config.botSettings.controllerIds
  if (!controllerList || (typeof controllerList === "object" && controllerList.length === 0)) return false;
  else if (typeof controllerList !== "object" || (typeof controllerList === "object" && controllerList.length === undefined)) {
    console.log(`Could not execute command "${command} due to incorrectly defined bot controller."`);
    return false;
  }
  for (var x in controllerList) return (controllerList[x] === author);
  return false
}

function logCommand(message, command) {
  return console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Used ${command}.`)
}

module.exports = function(bot, message) {
  if (!message.member || !message.member.hasPermission("MANAGE_CHANNELS") || message.author.bot) return;
  if (blacklistGuilds.ids.includes(message.guild.id)) return;

  let m = message.content.split(" ")
  let command = m[0].substr(config.botSettings.prefix.length)
  if (channelTracker.hasActiveMenus(message.channel.id)) return;

  // for regular commands
  for (var cmd in commandList) {
    if (cmd === command && checkPerm(bot, message, commandList[cmd].reqPerm)) {
      logCommand(message, command);
      return loadCommand(command)(bot, message, command);
    }
  }

  // for bot controller commands
  if (controllerCmds[command] && isBotController(command, message.author.id)) return controllerCmds[command](bot, message);
}
