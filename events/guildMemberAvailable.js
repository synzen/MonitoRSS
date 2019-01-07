const storage = require('../util/storage.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = member => {
  if (storage.redisClient) {
    storage.redisClient.sadd(storage.redisKeys.guildMembers(member.guild.id), member.id, err => err ? console.log(err) : null)
    if (member.hasPermission(MANAGE_CHANNELS_PERM)) {
      storage.redisClient.sadd(storage.redisKeys.guildManagers(member.guild.id), member.id, err => err ? console.log(err) : null)
    }
  }
}
