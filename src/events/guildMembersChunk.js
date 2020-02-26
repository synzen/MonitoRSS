const createLogger = require('../util/logger/create.js')
const storage = require('../util/storage.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')

module.exports = (members, guild) => {
  if (!storage.redisClient) {
    return
  }
  members.forEach(member => {
    RedisGuildMember.utils.recognize(member)
      .catch(err => {
        const log = createLogger(member.guild.shard.id)
        log.error(err, `Redis failed to recognize member after guildMembersChunk event`)
      })
  })
}
