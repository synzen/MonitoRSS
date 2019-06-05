const fs = require('fs')
const log = require('./logger.js')
const config = require('../config.js')
const storage = require('./storage.js')
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
if (fs.existsSync('./settings/commands.js')) {
  try { cmdsExtension = require('../settings/commands.js') } catch (e) { log.general.error(`Unable to load commands extension file`, e) }
  fs.watchFile('./settings/commands.js', (cur, prev) => {
    delete require.cache[require.resolve('../settings/commands.js')]
    try {
      cmdsExtension = require('../settings/commands.js')
      log.general.success(`Commands extension file has been updated`)
    } catch (e) {
      log.general.error(`Commands extension file was changed, but could not be updated`, e)
    }
  })
}

function messageHandler (message) {
  require('../events/message.js')(message, config.bot.enableCommands === true ? null : true)
  try { if (cmdsExtension) cmdsExtension(storage.bot, message) } catch (e) {}
}

exports.createManagers = () => {
  const fileNames = fs.readdirSync('./events')
  for (const fileName of fileNames) {
    const eventName = fileName.replace('.js', '')
    if (!VALID_EVENTS.includes(eventName)) throw new Error('Invalid event file found:', fileName)
    if (eventName === 'message') continue
    const eventHandler = require(`../events/${fileName}`)
    eventHandlers.push({ name: eventName, func: eventHandler })
    storage.bot.on(eventName, eventHandlers[eventHandlers.length - 1].func)
  }
}

exports.enableCommands = () => {
  eventHandlers.push({ name: 'message', func: messageHandler })
  storage.bot.on('message', eventHandlers[eventHandlers.length - 1].func)
  log.general.info(`${storage.bot.shard && storage.bot.shard.count > 0 ? 'SH ' + storage.bot.shard.id + ' ' : ''}Commands have been ${config.bot.enableCommands !== false ? 'enabled' : 'disabled'}.`)
}

exports.disableAll = () => {
  for (const eventHandler of eventHandlers) storage.bot.removeListener(eventHandler.name, eventHandler.func)
}
