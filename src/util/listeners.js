const fs = require('fs')
const path = require('path')
const Command = require('../structs/Command.js')

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
  'warn'
]

const messageHandler = message => {
  require('../events/message.js')(message)
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
  eventHandlers.push({ name: 'message', func: messageHandler })
  bot.on('message', eventHandlers[eventHandlers.length - 1].func)
  Command.enable()
}

exports.disableAll = (bot) => {
  for (const eventHandler of eventHandlers) {
    bot.removeListener(eventHandler.name, eventHandler.func)
  }
  eventHandlers.length = 0
  Command.disable()
}
