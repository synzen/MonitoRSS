const RedisRole = require('../structs/db/Redis/Role.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')
const createLogger = require('../util/logger/create.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = (oldRole, newRole) => {
  if (!RedisRole.clientExists) {
    return
  }
  const oldRoleHas = oldRole.permissions.has(MANAGE_CHANNELS_PERM)
  const newRoleHas = newRole.permissions.has(MANAGE_CHANNELS_PERM)
  const log = createLogger(newRole.guild.shard.id)
  if (oldRoleHas !== newRoleHas) {
    const newRoleMembers = newRole.members
    if (!newRoleHas) {
      newRoleMembers.forEach(member => {
        RedisGuildMember.utils.forgetManager(member)
          .catch(err => log.error(err, `Redis failed to members.forgetManager after roleUpdate event`))
      })
      RedisRole.utils.forgetManager(newRole)
        .catch(err => log.error(err, `Redis failed to roles.forgetManager after roleUpdate event`))
    } else {
      newRoleMembers.forEach(member => {
        RedisGuildMember.utils.recognizeManager(member)
          .catch(err => log.error(err, `Redis failed to members.recognizeManager after roleUpdate event`))
      })
      RedisRole.utils.recognizeManager(newRole)
        .catch(err => log.error(err, `Redis failed to roles.forgetManager after roleUpdate event`))
    }
  }
  RedisRole.utils.update(oldRole, newRole)
    .catch(err => log.error(err, `Redis failed to update role after roleUpdate event`))
}
