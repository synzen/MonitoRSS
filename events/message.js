const fs = require('fs')
const path = require('path')
const config = require('../config.json')
const loadCCommand = name => require(`../commands/controller/${name}.js`)
const commands = require('../util/commands.js')
const channelTracker = require('../util/channelTracker.js')
const storage = require('../util/storage.js')

function isBotController (id) {
  const controllerList = config.bot.controllerIds
  return controllerList.length === 0 ? false : controllerList.includes(id)
}

module.exports = (bot, message, limited) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(config.bot.prefix) || storage.blacklistGuilds.includes(message.guild.id) || storage.blacklistUsers.includes(message.author.id)) return
  const command = message.content.split(' ')[0].substr(config.bot.prefix.length)
  if (command === 'forceexit') return require(`../commands/forceexit.js`)(bot, message) // To forcibly clear a channel of active menus

  if (channelTracker.hasActiveMenus(message.channel.id)) return

  // Regular commands
  if (!limited && commands.has(command)) {
    if (storage.initialized < 2) return message.channel.send(`This command is disabled while booting up, please wait.`).then(m => m.delete(4000))
    return commands.run(bot, message, command)
  }

  // Bot controller commands
  if (isBotController(message.author.id)) {
    if (storage.initialized < 2) return message.channel.send(`This command is disabled while booting up, please wait.`).then(m => m.delete(4000))
    if (fs.existsSync(path.join(__dirname, '..', 'commands', 'controller', `${command}.js`))) loadCCommand(command)[bot.shard && bot.shard.count > 0 ? 'sharded' : 'normal'](bot, message)
  }
}
