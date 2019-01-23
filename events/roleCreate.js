const log = require('../util/logger.js')
const redisOps = require('../util/redisOps.js')

module.exports = async role => {
  redisOps.roles.recognize(role).catch(err => log.general.error(`Redis failed to recognize after roleCreate event`, role.guild, role, err))
}
