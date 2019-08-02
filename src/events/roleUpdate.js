const log = require('../util/logger.js')
const RedisRole = require('../structs/db/Redis/Role.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = (oldRole, newRole) => {
  if (RedisRole.clientExists) {
    const oldRoleHas = oldRole.hasPermission(MANAGE_CHANNELS_PERM)
    const newRoleHas = newRole.hasPermission(MANAGE_CHANNELS_PERM)
    if (oldRoleHas !== newRoleHas) {
      const newRoleMembers = newRole.members
      if (!newRoleHas) {
        newRoleMembers.forEach(member => RedisGuildMember.utils.forgetManager(member).catch(err => log.general.error(`Redis failed to members.forgetManager after roleUpdate event`, member.guild, member, err)))
        RedisRole.utils.forgetManager(newRole).catch(err => log.general.error(`Redis failed to roles.forgetManager after roleUpdate event`, newRole.guild, newRole, err))
      } else {
        newRoleMembers.forEach(member => RedisGuildMember.utils.recognizeManager(member).catch(err => log.general.error(`Redis failed to members.recognizeManager after roleUpdate event`, member.guild, member, err)))
        RedisRole.utils.recognizeManager(newRole).catch(err => log.general.error(`Redis failed to roles.forgetManager after roleUpdate event`, newRole.guild, newRole, err))
      }
    }
    RedisRole.utils.update(oldRole, newRole).catch(err => log.general.error(`Redis failed to update role after roleUpdate event`, err))
  }
}
