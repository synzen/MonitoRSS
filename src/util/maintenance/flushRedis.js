const RedisBase = require('../../structs/db/Redis/Base.js')
const promisify = require('util').promisify

async function flushRedis () {
  if (!RedisBase.clientExists) {
    return
  }
  const keys = await promisify(RedisBase.client.keys)
    .bind(RedisBase.client)('drss*')
  const multi = RedisBase.client.multi()
  if (keys && keys.length > 0) {
    for (const key of keys) {
      multi.del(key)
    }
    return new Promise((resolve, reject) => multi.exec((err, res) => err ? reject(err) : resolve(res)))
  }
}

module.exports = flushRedis
