const channelTracker = require('../util/channelTracker.js')
const createLogger = require('../util/logger/create.js')

module.exports = async guild => {
  const log = createLogger(guild.shard.id)
  log.info({ guild }, `Guild (Members: ${guild.memberCount}) has been removed`)
  guild.channels.cache.forEach((channel, channelId) => {
    if (channelTracker.hasActiveMenus(channelId)) {
      channelTracker.remove(channelId)
    }
  })
}
