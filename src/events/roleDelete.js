const Subscriber = require('../structs/db/Subscriber.js')
const log = require('../util/logger.js')
const RedisRole = require('../structs/db/Redis/Role.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = async role => {
  if (RedisRole.clientExists) {
    RedisRole.utils.forget(role)
      .catch(err => log.general.error(`Redis failed to forget after roleDelete event`, role.guild, role, err))
    if (role.permissions.has(MANAGE_CHANNELS_PERM)) {
      role.members.forEach(member => {
        RedisGuildMember.utils.forgetManager(member)
          .catch(err => log.general.error(`Redis failed to forgetManager after roleDelete event`, member.guild, member, err))
      })
    }
  }

  try {
    const subscribers = await Subscriber.getManyBy('id', role.id)
    subscribers.forEach(subscriber => {
      subscriber.delete()
        .catch(err => log.general.error('Failed to delete subscriber after role deletion', role.guild, role, err))
    })
  } catch (err) {
    log.guild.warning(`Role could not be removed from config by guild role deletion`, role.guild, role, err)
  }
}
