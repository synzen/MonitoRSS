const storage = require('../util/storage.js')

module.exports = member => {
  const guildId = member.guild.id
  if (storage.redisClient) {
    storage.redisClient.srem(storage.redisKeys.guildMembers(guildId), member.id, err => err ? console.log(err) : null)
    storage.redisClient.srem(storage.redisKeys.guildManagers(guildId), member.id, err => err ? console.log(err) : null)
  }
}
