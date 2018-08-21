const fs = require('fs')
const eventHandler = evnt => require(`../events/${evnt}.js`)
const log = require('./logger.js')
const config = require('../config.json')
const storage = require('./storage.js')
const pageControls = require('./pageControls.js')
const EVENT_HANDLERS = {
  guildCreate: guildCreateHandler,
  guildDelete: guildDeleteHandler,
  channelDelete: channelDeleteHandler,
  roleUpdate: roleUpdateHandler,
  roleDelete: roleDeleteHandler,
  guildUpdate: guildUpdateHandler,
  messageReactionAdd: messageReactionAddHandler,
  messageReactionRemove: messageReactionRemoveHandler,
  message: messageHandler
}
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

function guildCreateHandler (guild) {
  eventHandler('guildCreate')(storage.bot, guild)
}

function guildDeleteHandler (guild) {
  eventHandler('guildDelete')(storage.bot, guild)
}

function channelDeleteHandler (channel) {
  eventHandler('channelDelete')(channel)
}

function roleUpdateHandler (oldRole, newRole) {
  if (oldRole.name === newRole.name) return
  eventHandler('roleUpdate')(storage.bot, oldRole, newRole)
}

function roleDeleteHandler (role) {
  eventHandler('roleDelete')(storage.bot, role)
}

function guildUpdateHandler (oldGuild, newGuild) {
  if (newGuild.name === oldGuild.name) return
  eventHandler('guildUpdate')(storage.bot, oldGuild, newGuild)
}

function messageReactionAddHandler (msgReaction, user) {
  if ((msgReaction.emoji.name !== '▶' && msgReaction.emoji.name !== '◀') || user.bot || !pageControls.has(msgReaction.message.id)) return
  eventHandler('messageReactionAdd')(storage.bot, msgReaction, user)
}

function messageReactionRemoveHandler (msgReaction, user) {
  if ((msgReaction.emoji.name !== '▶' && msgReaction.emoji.name !== '◀') || user.bot || !pageControls.has(msgReaction.message.id)) return
  eventHandler('messageReactionRemove')(storage.bot, msgReaction, user)
}

function messageHandler (message) {
  eventHandler('message')(storage.bot, message, config.bot.enableCommands === true ? null : true)
  try { if (cmdsExtension) cmdsExtension(storage.bot, message) } catch (e) {}
}

exports.createManagers = () => {
  for (var eventName in EVENT_HANDLERS) {
    if (eventName !== 'message') storage.bot.on(eventName, EVENT_HANDLERS[eventName])
  }
}

exports.enableCommands = () => {
  storage.bot.on('message', messageHandler)
  log.general.info(`${storage.bot.shard && storage.bot.shard.count > 0 ? 'SH ' + storage.bot.shard.id + ' ' : ''}Commands have been ${config.bot.enableCommands !== false ? 'enabled' : 'disabled'}.`)
}

exports.disableAll = () => {
  for (var eventName in EVENT_HANDLERS) storage.bot.removeListener(eventName, EVENT_HANDLERS[eventName])
}
