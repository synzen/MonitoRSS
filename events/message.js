const config = require('../config.json')
const controllerCmds = require('../commands/controller/main.js')
const loadCommand = (file) => require(`../commands/${file}.js`)
const hasPerm = require('../util/hasPerm.js')
const commandList = require('../util/commandList.json')
const channelTracker = require('../util/channelTracker.js')
const blacklistGuilds = require('../util/storage.js').blacklistGuilds

function isBotController (command, author) {
  let controllerList = config.botSettings.controllerIds
  if (!controllerList || (typeof controllerList === 'object' && controllerList.length === 0)) return false
  else if (typeof controllerList !== 'object' || (typeof controllerList === 'object' && controllerList.length === undefined)) {
    console.log(`Could not execute command "${command} due to incorrectly defined bot controller."`)
    return false
  }
  for (var x in controllerList) if (controllerList[x] === author) return true
  return false
}

function logCommand (message) {
  return console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Used ${message.content}.`)
}

module.exports = function (bot, message) {
  if (!message.member || message.author.bot || !message.content.startsWith(config.botSettings.prefix)) return
  if (blacklistGuilds.ids.includes(message.guild.id)) return

  let m = message.content.split(' ')
  let command = m[0].substr(config.botSettings.prefix.length)
  if (command === 'forceexit') loadCommand(command)(bot, message) // To forcibly clear a channel of active menus

  if (channelTracker.hasActiveMenus(message.channel.id)) return

  // for regular commands
  for (var cmd in commandList) {
    if (cmd === command && hasPerm.bot(bot, message, commandList[cmd].botPerm) && hasPerm.user(message, commandList[cmd].userPerm)) {
      logCommand(message)
      return loadCommand(command)(bot, message, command)
    }
  }

  // for bot controller commands
  if (controllerCmds[command] && isBotController(command, message.author.id)) return controllerCmds[command][bot.shard ? 'sharded' : 'normal'](bot, message)
}
