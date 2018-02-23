const config = require('../config.json')
const fileOps = require('../util/fileOps.js')
const log = require('../util/logger.js')

module.exports = (bot, guild) => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been added`, guild)

  fileOps.restoreBackup(guild.id, null, err => {
    if (err) log.guild.warning(`Unable to restore backup`, guild, err)
    log.guild.info(`Restored backup`, guild)
  })

  if (!config.logging.discordChannelLog) return

  const logChannelId = config.logging.discordChannelLog
  const logChannel = bot.channels.get(logChannelId)
  if (typeof logChannelId !== 'string' || !logChannel) {
    if (bot.shard) {
      bot.shard.broadcastEval(`
        const log = require(require('path').dirname(require.main.filename) + '/util/logger.js')
        const channel = this.channels.get('${logChannelId}');
        if (channel) {
          channel.send('Guild Info: "${guild.name}" has been added.\\nUsers: ${guild.members.size}').catch(err => log.guild.warning('Could not log guild addition to Discord', channel.guild,  err));
          true;
        }
      `).then(results => {
        for (var x in results) if (results[x]) return
        log.general.error(`Error: Could not log guild addition to Discord, invalid channel ID`)
      }).catch(err => log.general.warning(`Guild Info: Error: Could not broadcast eval log channel send for guildCreate`, err))
    } else log.general.error(`Error: Could not log guild addition to Discord, invalid channel ID`)
  } else logChannel.send(`Guild Info: "${guild.name}" has been added.\nUsers: ${guild.members.size}`).catch(err => log.general.warning(`Could not log guild addition to Discord`, err))
}
