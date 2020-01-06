const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')

module.exports = async guild => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been removed`, guild)
  RedisGuild.utils.forget(guild).catch(err => log.general.error(`Redis failed to forget after guildDelete event`, guild, err))
  guild.channels.forEach((channel, channelId) => {
    if (channelTracker.hasActiveMenus(channelId)) {
      channelTracker.remove(channelId)
    }
  })
}
