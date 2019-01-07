const storage = require('../util/storage.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = (oldMember, newMember) => {
  const guildId = oldMember.id
  if (storage.redisClient) {
    const oldMemberHas = oldMember.hasPermission(MANAGE_CHANNELS_PERM)
    const newMemberHas = newMember.hasPermission(MANAGE_CHANNELS_PERM)
    if (oldMemberHas !== newMemberHas) {
      if (!newMemberHas) storage.redisClient.srem(storage.redisKeys.guildManagers(guildId), newMember.id, err => err ? console.log(err) : null)
      else storage.redisClient.sadd(storage.redisKeys.guildManagers(guildId), newMember.id, err => err ? console.log(err) : null)
    }
  }
}
