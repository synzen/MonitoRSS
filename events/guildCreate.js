const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')
const redisOps = require('../util/redisOps.js')

module.exports = guild => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been added`, guild)
  redisOps.guilds.recognize(guild).catch(err => log.general.error(`Redis failed to recognize after guildCreate event`, guild, err))

  dbOps.guildRss.restore(guild.id)
    .then(guildRss => guildRss ? log.guild.info(`Restored backup`, guild) : null)
    .catch(err => log.guild.warning(`Unable to attempt backup restoration`, guild, err))
}
