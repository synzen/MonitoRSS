const config = require('../config.json')
const controllerCmds = require('../commands/controller/main.js')
const loadCommand = (file) => require(`../commands/${file}.js`)
const hasPerm = require('../util/hasPerm.js')
const commandList = require('../util/commandList.json')
const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const blacklistGuilds = storage.blacklistGuilds
const blacklistUsers = storage.blacklistUsers

function isBotController (command, author) {
  const controllerList = config.botSettings.controllerIds
  return controllerList.length === 0 ? false : controllerList.includes(author)
}

module.exports = (bot, message) => {
  if (!message.member || message.author.bot || !message.content.startsWith(config.botSettings.prefix) || blacklistGuilds.includes(message.guild.id) || blacklistUsers.includes(message.author.id)) return
  let m = message.content.split(' ')
  let command = m[0].substr(config.botSettings.prefix.length)
  if (command === 'forceexit') loadCommand(command)(bot, message) // To forcibly clear a channel of active menus

  if (channelTracker.hasActiveMenus(message.channel.id)) return

  // Regular commands
  for (var cmd in commandList) {
    if (cmd === command && hasPerm.bot(bot, message, commandList[cmd].botPerm) && hasPerm.user(message, commandList[cmd].userPerm)) {
      if (storage.initializing) return message.channel.send(`Currently booting up, please wait.`).then(m => m.delete(4000))
      log.command.info(`Used ${message.content}`, message.guild)
      return loadCommand(command)(bot, message, command)
    }
  }

  // Bot controller commands
  if (controllerCmds[command] && isBotController(command, message.author.id)) {
    if (storage.initializing) return message.channel.send(`Currently booting up, please wait.`).then(m => m.delete(4000))
    return controllerCmds[command][bot.shard ? 'sharded' : 'normal'](bot, message)
  }
}
