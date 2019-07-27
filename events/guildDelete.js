const dbOpsGuilds = require('../util/db/guilds.js')
const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')

module.exports = async guild => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been removed`, guild)
  RedisGuild.utils.forget(guild).catch(err => log.general.error(`Redis failed to forget after guildDelete event`, guild, err))

  guild.channels.forEach((channel, channelId) => {
    if (channelTracker.hasActiveMenus(channelId)) channelTracker.remove(channelId)
  })
  try {
    const guildRss = await dbOpsGuilds.get(guild.id)
    if (!guildRss) return
    await dbOpsGuilds.remove(guildRss, true)
  } catch (err) {
    log.guild.warning(`Unable to delete guild from database`, guild, err)
  }
}
