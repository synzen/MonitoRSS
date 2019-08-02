const RedisUser = require('../structs/db/Redis/User.js')
const log = require('../util/logger.js')

module.exports = async (oldUser, newUser) => {
  RedisUser.utils.update(oldUser, newUser).catch(err => log.general.error(`Redis failed to update after userUpdate event`, newUser, err))
}
