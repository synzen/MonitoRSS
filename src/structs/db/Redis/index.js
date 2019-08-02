const Base = require('./Base.js')
const Channel = require('./Channel.js')
const Guild = require('./Guild.js')
const GuildMember = require('./GuildMember.js')
const Role = require('./Role.js')
const User = require('./User.js')
const promisify = require('util').promisify

const events = {
  NAMES: {
    DRSS_PROFILE_UPDATE: 'DRSS_PROFILE_UPDATE'
  },
  emitUpdatedProfile: guildId => {
    if (!Channel.clientExists) return
    if (!guildId) throw new TypeError(`Guild ID is not defined`)
    Channel.client.publish(events.NAMES.DRSS_PROFILE_UPDATE, guildId)
  }
}

const flushDatabase = async () => {
  if (!Channel.clientExists) return
  const keys = await promisify(Channel.client.keys).bind(Channel.client)('drss*')
  const multi = Channel.client.multi()
  if (keys && keys.length > 0) {
    for (const key of keys) {
      multi.del(key)
    }
    return new Promise((resolve, reject) => multi.exec((err, res) => err ? reject(err) : resolve(res)))
  }
  // return promisify(storage.redisClient.flushdb).bind(storage.redisClient)()
}

module.exports = {
  Base,
  Channel,
  Guild,
  GuildMember,
  Role,
  User,
  events,
  flushDatabase
}
