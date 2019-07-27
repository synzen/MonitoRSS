const dbOpsGuilds = require('../util/db/guilds.js')
const log = require('../util/logger.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')

module.exports = guild => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been added`, guild)
  RedisGuild.utils.recognize(guild).catch(err => log.general.error(`Redis failed to recognize after guildCreate event`, guild, err))

  dbOpsGuilds.restore(guild.id)
    .then(guildRss => guildRss ? log.guild.info(`Restored backup`, guild) : null)
    .catch(err => log.guild.warning(`Unable to attempt backup restoration`, guild, err))
}
