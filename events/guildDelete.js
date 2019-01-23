const dbOps = require('../util/dbOps.js')
const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')
const redisOps = require('../util/redisOps.js')

module.exports = async guild => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been removed`, guild)
  redisOps.guilds.forget(guild).catch(err => log.general.error(`Redis failed to forget after guildDelete event`, guild, err))

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
