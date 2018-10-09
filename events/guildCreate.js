const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')

module.exports = (bot, guild) => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been added`, guild)

  dbOps.guildRss.restore(guild.id)
    .then(guildRss => guildRss ? log.guild.info(`Restored backup`, guild) : null)
    .catch(err => log.guild.warning(`Unable to attempt backup restoration`, guild, err))
}
