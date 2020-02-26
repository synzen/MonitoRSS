const createLogger = require('../util/logger/create.js')
const RedisRole = require('../structs/db/Redis/Role.js')

module.exports = async role => {
  RedisRole.utils.recognize(role)
    .catch(err => {
      const log = createLogger(role.guild.shard.id)
      log.error(err, `Redis failed to recognize after roleCreate event`)
    })
}
