const RedisChannel = require('../structs/db/Redis/Channel.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const log = require('../util/logger.js')

module.exports = async channel => {
  RedisChannel.utils.forget(channel).catch(err => log.general.error(`Redis failed to forget after channelDelete event`, channel, err))
  const guildId = channel.guild.id
  try {
    const guildRss = await dbOpsGuilds.get(guildId)
    if (!guildRss) return
    const rssList = guildRss.sources
    if (!rssList) return
    for (const rssName in rssList) {
      const source = rssList[rssName]
      if (source.channel === channel.id) await dbOpsGuilds.removeFeed(guildRss, rssName)
    }
  } catch (err) {
    log.general.warning('Error while checking guild after channelDelete event', channel.guild, err)
  }
}
