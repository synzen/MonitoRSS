const config = require('../config.json')
const loadCommand = file => require(`../commands/${file}.js`)
const loadCCommand = file => require(`../commands/controller/${file}.js`)
const hasPerm = require('../util/hasPerm.js')
const commandList = require('../util/commandList.json')
const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')
const storage = require('../util/storage.js')

function isBotController (author) {
  const controllerList = config.bot.controllerIds
  return controllerList.length === 0 ? false : controllerList.includes(author)
}

module.exports = (bot, message) => {
  if (!message.member || message.author.bot || !message.content.startsWith(config.bot.prefix) || storage.blacklistGuilds.includes(message.guild.id) || storage.blacklistUsers.includes(message.author.id)) return
  let m = message.content.split(' ')
  let command = m[0].substr(config.bot.prefix.length)
  if (command === 'forceexit') return loadCommand(command)(bot, message) // To forcibly clear a channel of active menus

  if (channelTracker.hasActiveMenus(message.channel.id)) return

  // Regular commands
  for (var cmd in commandList) {
    const cmdData = commandList[cmd]
    if (cmd === command && hasPerm.bot(bot, message, cmdData.botPerm) && hasPerm.user(message, cmdData.userPerm)) {
      if (cmdData.initLevel != null && cmdData.initLevel > storage.initialized) return message.channel.send(`This function is disabled while booting up, please wait.`).then(m => m.delete(4000))
      log.command.info(`Used ${message.content}`, message.guild)
      return loadCommand(command)(bot, message, command)
    }
  }

  // Bot controller commands
  if (isBotController(message.author.id)) {
    if (storage.initialized < 2) return message.channel.send(`This function is disabled while booting up, please wait.`).then(m => m.delete(4000))
    try {
      loadCCommand(command)[bot.shard ? 'sharded' : 'normal'](bot, message)
    } catch (e) {}
  }
}
