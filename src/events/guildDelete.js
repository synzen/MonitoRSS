const channelTracker = require('../util/channelTracker.js')
const createLogger = require('../util/logger/create.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')

module.exports = async guild => {
  const log = createLogger(guild.shard.id)
  log.info({ guild }, `Guild (Users: ${guild.members.cache.size}) has been removed`)
  RedisGuild.utils.forget(guild)
    .catch(err => log.error(err, `Redis failed to forget after guildDelete event`))
  guild.channels.cache.forEach((channel, channelId) => {
    if (channelTracker.hasActiveMenus(channelId)) {
      channelTracker.remove(channelId)
    }
  })
}
