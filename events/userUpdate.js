const redisOps = require('../util/redisOps.js')
const log = require('../util/logger.js')

module.exports = async (oldUser, newUser) => {
  redisOps.users.update(oldUser, newUser).catch(err => log.general.error(`Redis failed to update after userUpdate event`, newUser, err))
}
