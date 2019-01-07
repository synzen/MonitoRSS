const storage = require('../util/storage.js')

module.exports = channel => {
  if (storage.redisClient) {
    storage.redisClient.sadd(storage.redisKeys.guildChannels(channel.guild.id), channel.id, err => err ? console.log(err) : null)
  }
}
