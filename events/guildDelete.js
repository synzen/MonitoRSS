const dbOps = require('../util/dbOps.js')
const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')
const storage = require('../util/storage.js')

module.exports = async guild => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been removed`, guild)
  if (storage.redisClient) {
    storage.redisClient.srem(storage.redisKeys.guilds(), guild.id, err => err ? console.log(err) : null)
    storage.redisClient.del(storage.redisKeys.guildManagers(guild.id), err => err ? console.log(err) : null)
  }

  guild.channels.forEach((channel, channelId) => {
    if (channelTracker.hasActiveMenus(channelId)) channelTracker.remove(channelId)
  })
  try {
    const guildRss = await dbOps.guildRss.get(guild.id)
    if (!guildRss) return
    await dbOps.guildRss.remove(guildRss, true)
  } catch (err) {
    log.guild.warning(`Unable to delete guild from database`, guild, err)
  }
}
