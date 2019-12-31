const channelTracker = require('../util/channelTracker.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Feed = require('../structs/db/Feed.js')
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
  const profile = await GuildProfile.get(guild.id)
  const feeds = await Feed.getBy('guild', guild.id)
  if (profile) {
    profile.delete()
      .catch(err => log.general.error(`Failed to delete guild after guild delete event`, guild, err))
  }
  feeds.forEach(feed => {
    feed.delete()
      .catch(err => log.general.error(`Failed to delete feed ${feed._id} after guild deletion`, err))
  })
}
