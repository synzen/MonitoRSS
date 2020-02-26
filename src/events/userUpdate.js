const RedisUser = require('../structs/db/Redis/User.js')
const createLogger = require('../util/logger/create.js')

module.exports = async (oldUser, newUser) => {
  RedisUser.utils.update(oldUser, newUser)
    .catch(err => {
      const log = createLogger(newUser.client.shard.ids[0])
      log.error(err, `Redis failed to update after userUpdate event`)
    })
}
