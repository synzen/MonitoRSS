const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')

module.exports = async (bot, guild) => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been added`, guild)

  dbOps.guildRss.restore(guild.id, (err, restored) => {
    if (err) return log.guild.warning(`Unable to attempt backup restoration`, guild, err)
    if (restored) log.guild.info(`Restored backup`, guild)
  })
}
