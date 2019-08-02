const log = require('../util/logger.js')
const RedisRole = require('../structs/db/Redis/Role.js')

module.exports = async role => {
  RedisRole.utils.recognize(role).catch(err => log.general.error(`Redis failed to recognize after roleCreate event`, role.guild, role, err))
}
