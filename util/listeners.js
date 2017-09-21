const fs = require('fs')
const eventHandler = (evnt) => require(`../events/${evnt}.js`)
const pageControls = require('./pageControls.js')
let cmdsExtension
if (fs.existsSync('./settings/commands.js')) try { cmdsExtension = require('../settings/commands.js') } catch (e) { console.log(`Error: Unable to load commands extension file. Reason:\n`, e) }

if (fs.existsSync('./settings/commands.js')) {
  fs.watchFile('./settings/commands.js', function (cur, prev) {
    delete require.cache[require.resolve('../settings/commands.js')]
    try {
      cmdsExtension = require('../settings/commands.js')
      console.log(`Commands extension file has been updated`)
    } catch (e) {
      console.log(`Commands extension file was changed, but could not be updated. Reason:\n`, e)
    }
  })
}

exports.createManagers = function (bot) {
  bot.on('guildCreate', function (guild) {
    eventHandler('guildCreate')(bot, guild)
  })

  bot.on('guildDelete', function (guild) {
    eventHandler('guildDelete')(bot, guild)
  })

  bot.on('channelDelete', function (channel) {
    if (!fs.existsSync(`./sources/${channel.guild.id}.json`)) return
    eventHandler('channelDelete')(channel)
  })

  bot.on('roleUpdate', function (oldRole, newRole) {
    if (oldRole.name === newRole.name || !fs.existsSync(`./sources/${oldRole.guild.id}.json`)) return
    eventHandler('roleUpdate')(bot, oldRole, newRole)
  })

  bot.on('roleDelete', function (role) {
    eventHandler('roleDelete')(bot, role)
  })

  bot.on('guildUpdate', function (oldGuild, newGuild) {
    if (newGuild.name === oldGuild.name || !fs.existsSync(`./sources/${oldGuild.id}.json`)) return
    eventHandler('guildUpdate')(bot, oldGuild, newGuild)
  })

  bot.on('messageReactionAdd', function (msgReaction, user) {
    if ((msgReaction.emoji.name !== '▶' && msgReaction.emoji.name !== '◀') || user.bot || !pageControls.has(msgReaction.message.id)) return
    eventHandler('messageReactionAdd')(bot, msgReaction, user)
  })
}

exports.enableCommands = function (bot) {
  bot.on('message', function (message) {
    eventHandler('message')(bot, message)
    try { if (cmdsExtension) cmdsExtension(bot, message) } catch (e) {}
  })

  console.log(`${bot.shard ? 'SH ' + bot.shard.id + ' ' : ''}Commands have been enabled.`)
}
