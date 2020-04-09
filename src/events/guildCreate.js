const createLogger = require('../util/logger/create.js')

module.exports = guild => {
  const log = createLogger(guild.shard.id)
  log.info({ guild }, `Guild (Members: ${guild.memberCount}) has been added`)
}
