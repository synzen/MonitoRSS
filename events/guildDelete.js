const config = require('../config.json')
const dbOps = require('../util/dbOps.js')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const log = require('../util/logger.js')

module.exports = async (bot, guild) => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been removed`, guild)

  guild.channels.forEach((channel, channelId) => {
    if (channelTracker.hasActiveMenus(channelId)) channelTracker.remove(channelId)
  })

  const guildRss = currentGuilds.get(guild.id)
  if (!guildRss) return

  dbOps.guildRss.remove(guild.id, err => {
    if (err) log.guild.warning(`Unable to delete guild from database`, guild, err)
  })

  if (!config.log.discordChannel) return

  const logChannelId = config.log.discordChannel
  const logChannel = bot.channels.get(config.log.discordChannel)
  try {
    if (typeof logChannelId !== 'string' || !logChannel) {
      if (bot.shard) {
        const results = await bot.shard.broadcastEval(`
          const log = require(require('path').dirname(require.main.filename) + '/util/logger.js')
          const channel = this.channels.get('${logChannelId}');
          if (channel) {
            channel.send('Guild Info: "${guild.name.replace(/\'/, "\\'")}" has been removed.\\nUsers: ${guild.members.size}').catch(err => log.guild.warning('Could not log guild removal to Discord', channel.guild, err));
            true;
          }
        `)
        for (var x in results) if (results[x]) return
        log.general.error(`Could not log guild addition to Discord, invalid channel ID`)
      } else log.general.error(`Error: Could not log guild removal to Discord, invalid channel ID.`)
    } else await logChannel.send(`Guild Info: "${guild.name}" has been removed.\nUsers: ${guild.members.size}`)
  } catch (err) {
    log.general.warning('guildDelete event', err)
  }
}
