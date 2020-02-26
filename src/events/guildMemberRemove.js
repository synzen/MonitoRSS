const createLogger = require('../util/logger/create.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')

module.exports = member => {
  RedisGuildMember.utils.forget(member)
    .catch(err => {
      const log = createLogger(member.guild.shard.id)
      log.error(err, `Redis failed to forget after guildMemberRemove event`)
    })
}
