const config = require('../config.json')
const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')

module.exports = async (bot, guild) => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been added`, guild)

  dbOps.guildRss.restore(guild.id, err => {
    if (err) log.guild.warning(`Unable to restore backup`, guild, err)
    log.guild.info(`Restored backup`, guild)
  })

  if (!config.log.discordChannel) return

  const logChannelId = config.log.discordChannel
  const logChannel = bot.channels.get(logChannelId)
  try {
    if (typeof logChannelId !== 'string' || !logChannel) {
      if (bot.shard) {
        const results = await bot.shard.broadcastEval(`
          const log = require(require('path').dirname(require.main.filename) + '/util/logger.js')
          const channel = this.channels.get('${logChannelId}');
          if (channel) {
            channel.send('Guild Info: "${guild.name.replace(/\'/, "\\'")}" has been added.\\nUsers: ${guild.members.size}').catch(err => log.guild.warning('Could not log guild addition to Discord', channel.guild,  err));
            true;
          }
        `)
        for (var x in results) if (results[x]) return
        log.general.error(`Error: Could not log guild addition to Discord, invalid channel ID`)
      } else log.general.error(`Error: Could not log guild addition to Discord, invalid channel ID`)
    } else await logChannel.send(`Guild Info: "${guild.name}" has been added.\nUsers: ${guild.members.size}`)
  } catch (err) {
    log.general.warning('guildCreate event', err)
  }
}
