const storage = require('../util/storage.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = (members, guild) => {
  const guildId = guild.id
  if (storage.redisClient) {
    members.forEach((member, userId) => {
      storage.redisClient.sadd(storage.redisKeys.guildMembers(guildId), userId, err => err ? console.log(err) : null)
      if (member.hasPermission(MANAGE_CHANNELS_PERM)) storage.redisClient.sadd(storage.redisKeys.guildManagers(guildId), userId, err => err ? console.log(err) : null)
    })
  }
}
