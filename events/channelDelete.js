const redisOps = require('../util/redisOps.js')
const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')

module.exports = async channel => {
  redisOps.channels.forget(channel).catch(err => log.general.error(`Redis failed to forget after channelDelete event`, channel, err))
  const guildId = channel.guild.id
  try {
    const guildRss = await dbOps.guildRss.get(guildId)
    if (!guildRss) return
    const rssList = guildRss.sources
    if (!rssList) return
    for (const rssName in rssList) {
      const source = rssList[rssName]
      if (source.channel === channel.id) await dbOps.guildRss.removeFeed(guildRss, rssName)
    }
  } catch (err) {
    log.general.warning('Error while checking guild after channelDelete event', channel.guild, err)
  }
}
