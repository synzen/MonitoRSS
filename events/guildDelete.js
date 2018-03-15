const config = require('../config.json')
const dbCmds = require('../rss/db/commands.js')
const dbOps = require('../util/dbOps.js')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const log = require('../util/logger.js')

module.exports = (bot, guild) => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been removed`, guild)

  guild.channels.forEach((channel, channelId) => {
    if (channelTracker.hasActiveMenus(channelId)) channelTracker.remove(channelId)
  })

  const guildRss = currentGuilds.get(guild.id)
  if (!guildRss) return
  const rssList = guildRss.sources

  dbOps.guildRss.remove(guild.id, null, err => {
    if (err) log.guild.warning(`Unable to delete guild from database`, guild, err)
  })

  if (!config.log.discordChannel) return

  const logChannelId = config.log.discordChannel
  const logChannel = bot.channels.get(config.log.discordChannel)
  if (typeof logChannelId !== 'string' || !logChannel) {
    if (bot.shard) {
      bot.shard.broadcastEval(`
        const log = require(require('path').dirname(require.main.filename) + '/util/logger.js')
        const channel = this.channels.get('${logChannelId}');
        if (channel) {
          channel.send('Guild Info: "${guild.name}" has been removed.\\nUsers: ${guild.members.size}').catch(err => log.guild.warning('Could not log guild removal to Discord', channel.guild, err));
          true;
        }
      `).then(results => {
        for (var x in results) if (results[x]) return
        log.general.error(`Could not log guild addition to Discord, invalid channel ID`)
      }).catch(err => log.guild.warning(`Could not broadcast eval log channel send for guildDelete`, err))
    } else log.general.error(`Error: Could not log guild removal to Discord, invalid channel ID.`)
  } else logChannel.send(`Guild Info: "${guild.name}" has been removed.\nUsers: ${guild.members.size}`).catch(err => log.general.warning(`Could not log guild removal to Discord`, err))
}
