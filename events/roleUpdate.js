const log = require('../util/logger.js')
const redisOps = require('../util/redisOps.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = (oldRole, newRole) => {
  if (redisOps.client.exists()) {
    const oldRoleHas = oldRole.hasPermission(MANAGE_CHANNELS_PERM)
    const newRoleHas = newRole.hasPermission(MANAGE_CHANNELS_PERM)
    if (oldRoleHas !== newRoleHas) {
      const newRoleMembers = newRole.members
      if (!newRoleHas) {
        newRoleMembers.forEach(member => redisOps.members.removeManager(member).catch(err => log.general.error(`Redis failed to members.removeManager after roleUpdate event`, member.guild, member, err)))
        redisOps.roles.removeManager(newRole).catch(err => log.general.error(`Redis failed to roles.removeManager after roleUpdate event`, newRole.guild, newRole, err))
      } else {
        newRoleMembers.forEach(member => redisOps.members.addManager(member).catch(err => log.general.error(`Redis failed to members.addManager after roleUpdate event`, member.guild, member, err)))
        redisOps.roles.addManager(newRole).catch(err => log.general.error(`Redis failed to roles.removeManager after roleUpdate event`, newRole.guild, newRole, err))
      }
    }
    redisOps.roles.update(oldRole, newRole)
  }
}
