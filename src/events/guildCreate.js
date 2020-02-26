const createLogger = require('../util/logger/create.js')
const RedisGuild = require('../structs/db/Redis/Guild.js')

module.exports = guild => {
  const log = createLogger(guild.shard.id)
  log.info({ guild }, `Guild (Users: ${guild.members.cache.size}) has been added`)
  RedisGuild.utils.recognize(guild)
    .catch(err => log.error(err, `Redis failed to recognize after guildCreate event`))
}
