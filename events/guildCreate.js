const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')

module.exports = async (bot, guild) => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been added`, guild)

  dbOps.guildRss.restore(guild.id, err => {
    if (err) log.guild.warning(`Unable to restore backup`, guild, err)
    log.guild.info(`Restored backup`, guild)
  })
}
