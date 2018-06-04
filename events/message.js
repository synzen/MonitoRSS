const config = require('../config.json')
const loadCommand = file => require(`../commands/${file}.js`)
const loadCCommand = file => require(`../commands/controller/${file}.js`)
const hasPerm = require('../util/hasPerm.js')
const commands = require('../util/commands.json')
const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')
const storage = require('../util/storage.js')

function isBotController (author) {
  const controllerList = config.bot.controllerIds
  return controllerList.length === 0 ? false : controllerList.includes(author)
}

module.exports = (bot, message, limited) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(config.bot.prefix) || storage.blacklistGuilds.includes(message.guild.id) || storage.blacklistUsers.includes(message.author.id)) return
  let m = message.content.split(' ')
  let command = m[0].substr(config.bot.prefix.length)
  if (!limited && command === 'forceexit') return loadCommand(command)(bot, message) // To forcibly clear a channel of active menus

  if (channelTracker.hasActiveMenus(message.channel.id)) return

  // Regular commands
  if (!limited) {
    for (var cmd in commands) {
      const cmdData = commands[cmd]
      if (cmd === command && hasPerm.bot(bot, message, cmdData.botPerm)) {
        return hasPerm.user(message, cmdData.userPerm, (err, allowed, permission) => {
          if (err) return log.command.warning('Unable to fetch member', message.guild, message.author, err, true)
          if (!allowed) return message.reply(`You do not have the required permission ${permission} to use this command.`)
          if (cmdData.initLevel != null && cmdData.initLevel > storage.initialized) return message.channel.send(`This function is disabled while booting up, please wait.`).then(m => m.delete(4000))
          log.command.info(`Used ${message.content}`, message.guild)
          loadCommand(command)(bot, message, command)
        })
      }
    }
  }

  // Bot controller commands
  if (isBotController(message.author.id)) {
    if (storage.initialized < 2) return message.channel.send(`This function is disabled while booting up, please wait.`).then(m => m.delete(4000))
    try {
      loadCCommand(command)[bot.shard && bot.shard.count > 0 ? 'sharded' : 'normal'](bot, message)
    } catch (e) {}
  }
}
