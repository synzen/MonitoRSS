const config = require('../config.json')

module.exports = function (bot, guild) {
  console.log(`Guild "${guild.name}" (Users: ${guild.members.size}) has been added.`)

  if (!config.logging.discordChannelLog) return

  const logChannelId = config.logging.discordChannelLog
  const logChannel = bot.channels.get(logChannelId)
  if (typeof logChannelId !== 'string' || !logChannel) {
    if (bot.shard) {
      bot.shard.broadcastEval(`
        const channel = this.channels.get('${logChannelId}');
        if (channel) {
          channel.send('Guild Info: "${guild.name}" has been added.\\nUsers: ${guild.members.size}').catch(err => console.log('Could not log guild addition to Discord, ', err.message || err));
          true;
        }
      `).then(results => {
        for (var x in results) if (results[x]) return
        console.log(`Error: Could not log guild addition to Discord, invalid channel ID.`)
      }).catch(err => console.log(`Guild Info: Error: Could not broadcast eval log channel send for guildCreate. `, err.message || err))
    } else console.log(`Error: Could not log guild addition to Discord, invalid channel ID.`)
  } else logChannel.send(`Guild Info: "${guild.name}" has been added.\nUsers: ${guild.members.size}`).catch(err => console.log(`Could not log guild addition to Discord. `, err.message || err))
}
