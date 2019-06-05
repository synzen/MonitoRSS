const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'
const log = require('../util/logger.js')
const redisOps = require('../util/redisOps.js')

module.exports = (oldMember, newMember) => {
  if (redisOps.client.exists()) {
    const oldMemberHas = oldMember.hasPermission(MANAGE_CHANNELS_PERM)
    const newMemberHas = newMember.hasPermission(MANAGE_CHANNELS_PERM)
    if (oldMemberHas !== newMemberHas) {
      if (!newMemberHas) redisOps.members.removeManager(newMember).catch(err => log.general.error(`Redis failed to removeManager after guildMemberUpdate event`, newMember.guild, newMember, err))
      else redisOps.members.addManager(newMember).catch(err => log.general.error(`Redis failed to addManager after guildMemberUpdate event`, newMember.guild, newMember, err))
    }
  }
}
