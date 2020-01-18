const fs = require('fs')
const path = require('path')
const log = require('./logger.js')
const config = require('../config.js')
const Blacklist = require('../structs/db/Blacklist.js')
const BlacklistCache = require('../structs/BlacklistCache.js')
const eventHandlers = []
const VALID_EVENTS = [
  'channelCreate',
  'channelDelete',
  'channelPinsUpdate',
  'channelUpdate',
  'clientUserGuildSettingsUpdate',
  'clientUserSettingsUpdate',
  'debug',
  'disconnect',
  'emojiCreate',
  'emojiDelete',
  'emojiUpdate',
  'error',
  'guildBanAdd',
  'guildBanRemove',
  'guildCreate',
  'guildDelete',
  'guildMemberAdd',
  'guildMemberAvailable',
  'guildMemberRemove',
  'guildMembersChunk',
  'guildMemberSpeaking',
  'guildMemberUpdate',
  'guildUnavailable',
  'guildUpdate',
  'message',
  'messageDelete',
  'messageDeleteBulk',
  'messageReactionAdd',
  'messageReactionRemove',
  'messageReactionRemoveAll',
  'messageUpdate',
  'presenceUpdate',
  'rateLimit',
  'ready',
  'reconnecting',
  'resume',
  'roleCreate',
  'roleDelete',
  'roleUpdate',
  'typingStart',
  'typingStop',
  'userNoteUpdate',
  'userUpdate',
  'voiceStateUpdate',
  'warn' ]

let cmdsExtension
if (fs.existsSync(path.join(__dirname, '..', '..', 'settings', 'commands.js'))) {
  try {
    cmdsExtension = require('../../settings/commands.js')
  } catch (e) {
    log.general.error(`Unable to load commands extension file`, e)
  }
  fs.watchFile(path.join(__dirname, '..', '..', 'settings', 'commands.js'), (cur, prev) => {
    delete require.cache[require.resolve('../../settings/commands.js')]
    try {
      cmdsExtension = require('../../settings/commands.js')
      log.general.success(`Commands extension file has been updated`)
    } catch (e) {
      log.general.error(`Commands extension file was changed, but could not be updated`, e)
    }
  })
}

const messageHandler = (bot, blacklistCache) => message => {
  const onlyOwner = config.bot.enableCommands !== true || config.dev === true
  require('../events/message.js')(message, onlyOwner, blacklistCache)
  try {
    if (cmdsExtension) {
      cmdsExtension(bot, message)
    }
  } catch (e) {}
}

exports.createManagers = (bot) => {
  const fileNames = fs.readdirSync(path.join(__dirname, '..', 'events'))
  for (const fileName of fileNames) {
    const eventName = fileName.replace('.js', '')
    if (!VALID_EVENTS.includes(eventName)) {
      throw new Error('Invalid event file found:', fileName)
    }
    if (eventName === 'message') continue
    const eventHandler = require(`../events/${fileName}`)
    eventHandlers.push({ name: eventName, func: eventHandler })
    bot.on(eventName, eventHandlers[eventHandlers.length - 1].func)
  }
}

exports.enableCommands = async (bot) => {
  const blacklistCache = new BlacklistCache(await Blacklist.getAll())
  eventHandlers.push({ name: 'message', func: messageHandler(bot, blacklistCache) })
  bot.on('message', eventHandlers[eventHandlers.length - 1].func)
}

exports.disableAll = (bot) => {
  for (const eventHandler of eventHandlers) {
    bot.removeListener(eventHandler.name, eventHandler.func)
  }
}
