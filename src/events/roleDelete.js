const Subscriber = require('../structs/db/Subscriber.js')
const RedisRole = require('../structs/db/Redis/Role.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')
const createLogger = require('../util/logger/create.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = async role => {
  const log = createLogger(role.guild.shard.id)
  if (RedisRole.clientExists) {
    RedisRole.utils.forget(role)
      .catch(err => {
        log.error(err, `Redis failed to forget after roleDelete event`)
      })
    if (role.permissions.has(MANAGE_CHANNELS_PERM)) {
      role.members.forEach(member => {
        RedisGuildMember.utils.forgetManager(member)
          .catch(err => {
            log.error(err, `Redis failed to forgetManager after roleDelete event`)
          })
      })
    }
  }

  try {
    const subscribers = await Subscriber.getManyBy('id', role.id)
    subscribers.forEach(subscriber => {
      subscriber.delete()
        .catch(err => {
          log.error(err, 'Failed to delete subscriber after role deletion')
        })
    })
  } catch (err) {
    log.error(err, `Role could not be removed from config by guild role deletion`)
  }
}
