const config = require('../config.json')

module.exports = function (bot, guild) {

  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been added.`)
  if (config.logging.discordChannelLog === undefined || config.logging.discordChannelLog === "") return;

  if (bot.channels.get(config.logging.discordChannelLog) !== null) bot.channels.get(config.logging.discordChannelLog).sendMessage(`Guild Info: "${guild.name}" has been added.\nUsers: ${guild.members.size}`).catch(err => console.log(`Could not log guild addition to Discord, reason: `, err));
  else console.log(`Error: Could not log guild addition to Discord, invalid channel ID.`);

}
