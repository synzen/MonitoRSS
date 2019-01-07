const dbOps = require('../util/dbOps.js')
const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

module.exports = guild => {
  log.guild.info(`Guild (Users: ${guild.members.size}) has been added`, guild)

  if (storage.redisClient) {
    const guildId = guild.id
    storage.redisClient.sadd(storage.redisKeys.guilds(), guildId, err => err ? console.log(err) : null)
    guild.members.forEach((member, userId) => {
      storage.redisClient.sadd(storage.redisKeys.guildMembers(guildId), userId, err => err ? console.log(err) : null)
      if (member.hasPermission(MANAGE_CHANNELS_PERM)) {
        storage.redisClient.sadd(storage.redisKeys.guildManagers(guildId), userId, err => err ? console.log(err) : null)
      }
    })
  }

  dbOps.guildRss.restore(guild.id)
    .then(guildRss => guildRss ? log.guild.info(`Restored backup`, guild) : null)
    .catch(err => log.guild.warning(`Unable to attempt backup restoration`, guild, err))
}
