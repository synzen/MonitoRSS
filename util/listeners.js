const fs = require('fs')
const eventHandler = evnt => require(`../events/${evnt}.js`)
const log = require('./logger.js')
const pageControls = require('./pageControls.js')
let cmdsExtension
if (fs.existsSync('./settings/commands.js')) try { cmdsExtension = require('../settings/commands.js') } catch (e) { console.log(`Error: Unable to load commands extension file. Reason:\n`, e) }

if (fs.existsSync('./settings/commands.js')) {
  fs.watchFile('./settings/commands.js', (cur, prev) => {
    delete require.cache[require.resolve('../settings/commands.js')]
    try {
      cmdsExtension = require('../settings/commands.js')
      console.log(`Commands extension file has been updated`)
    } catch (e) {
      console.log(`Commands extension file was changed, but could not be updated. Reason:\n`, e)
    }
  })
}

exports.createManagers = bot => {
  bot.on('guildCreate', guild => {
    eventHandler('guildCreate')(bot, guild)
  })

  bot.on('guildDelete', guild => {
    eventHandler('guildDelete')(bot, guild)
  })

  bot.on('channelDelete', channel => {
    eventHandler('channelDelete')(channel)
  })

  bot.on('roleUpdate', (oldRole, newRole) => {
    if (oldRole.name === newRole.name) return
    eventHandler('roleUpdate')(bot, oldRole, newRole)
  })

  bot.on('roleDelete', role => {
    eventHandler('roleDelete')(bot, role)
  })

  bot.on('guildUpdate', (oldGuild, newGuild) => {
    if (newGuild.name === oldGuild.name) return
    eventHandler('guildUpdate')(bot, oldGuild, newGuild)
  })

  bot.on('messageReactionAdd', (msgReaction, user) => {
    if ((msgReaction.emoji.name !== '▶' && msgReaction.emoji.name !== '◀') || user.bot || !pageControls.has(msgReaction.message.id)) return
    eventHandler('messageReactionAdd')(bot, msgReaction, user)
  })

  bot.on('messageReactionRemove', (msgReaction, user) => {
    if ((msgReaction.emoji.name !== '▶' && msgReaction.emoji.name !== '◀') || user.bot || !pageControls.has(msgReaction.message.id)) return
    eventHandler('messageReactionRemove')(bot, msgReaction, user)
  })
}

exports.enableCommands = bot => {
  bot.on('message', function (message) {
    eventHandler('message')(bot, message)
    try { if (cmdsExtension) cmdsExtension(bot, message) } catch (e) {}
  })

  log.general.info(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Commands have been enabled`)
}
