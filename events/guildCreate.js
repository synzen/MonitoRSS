const config = require('../config.json')

module.exports = function (bot, guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been added.`)

  if (!config.logging.discordChannelLog) return;
  let logChannelId = config.logging.discordChannelLog;
  let logChannel = bot.channels.get(logChannelId)
  if (typeof logChannelId !== "string" || !logChannel) console.log(`Error: Could not log guild addition to Discord, invalid channel ID.`);
  else logChannel.sendMessage(`Guild Info: "${guild.name}" has been added.\nUsers: ${guild.members.size}`).catch(err => console.log(`Could not log guild addition to Discord, reason: `, err));

}
