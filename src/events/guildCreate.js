const createLogger = require('../util/logger/create.js')

module.exports = guild => {
  const log = createLogger(guild.shard.id)
  log.info({ guild }, `Guild (Users: ${guild.members.cache.size}) has been added`)
}
