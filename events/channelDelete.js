const storage = require('../util/storage.js')
const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')

module.exports = async channel => {
  if (storage.redisClient) {
    storage.redisClient.srem(storage.redisKeys.guildChannels(channel.guild.id), channel.id, err => err ? console.log(err) : null)
  }
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
