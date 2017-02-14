const eventHandler = (evnt) => require(`../events/${evnt}.js`)
const fileOps = require('../util/updateJSON.js')
const config = require('../config.json')

exports.createAllListeners = function (bot) {
  bot.on('ready', function() {
    console.log("Discord.RSS commands module activated and online.")
  })

  bot.on('message', function (message) {
    eventHandler('message')(bot, message)
  })

  bot.on('guildCreate', function (guild) {
    eventHandler('guildCreate')(bot, guild)
  })

  bot.on('guildDelete', function (guild) {
    eventHandler('guildDelete')(bot, guild)
  })

  bot.on('channelDelete', function (channel) {
    if (!fileOps.exists(`./sources/${channel.guild.id}.json`)) return;
    eventHandler('channelDelete')(channel)
  })

  bot.on('roleUpdate', function (oldRole, newRole) {
    if (oldRole.name === newRole.name || !fileOps.exists(`./sources/${oldRole.guild.id}.json`)) return;
    eventHandler('roleUpdate')(bot, oldRole, newRole)
  })

  bot.on('roleDelete', function (role) {
    eventHandler('roleDelete')(bot, role)
  })

  bot.on('guildUpdate', function (oldGuild, newGuild) {
    if (newGuild.name === oldGuild.name || !fileOps.exists(`./sources/${oldGuild.id}.json`)) return;
    eventHandler('guildUpdate')(bot, oldGuild, newGuild)
  })

}

exports.removeAllListeners = function (bot) {
  bot.removeAllListeners('ready')
  bot.removeAllListeners('message')
  bot.removeAllListeners('guildCreate')
  bot.removeAllListeners('guildUpdate')
  bot.removeAllListeners('guildDelete')
  bot.removeAllListeners('channelDelete')
  bot.removeAllListeners('roleUpdate')
  bot.removeAllListeners('roleDelete')
}
