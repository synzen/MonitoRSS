const dbOps = require('../util/dbOps.js')
const channelTracker = require('../util/channelTracker.js')
const log = require('../util/logger.js')

module.exports = async (bot, guild) => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been removed`, guild)

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
