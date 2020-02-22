const log = require('../util/logger.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')

module.exports = guild => {
  log.guild.info(`Guild (Users: ${guild.members.cache.size}) has been added`, guild)
  RedisGuild.utils.recognize(guild)
    .catch(err => log.general.error(`Redis failed to recognize after guildCreate event`, guild, err))
}
