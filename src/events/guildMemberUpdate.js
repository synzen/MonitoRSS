const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'
const createLogger = require('../util/logger/create.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')

module.exports = (oldMember, newMember) => {
  if (RedisGuildMember.clientExists) {
    const oldMemberHas = oldMember.permissions.has(MANAGE_CHANNELS_PERM)
    const newMemberHas = newMember.permissions.has(MANAGE_CHANNELS_PERM)
    if (oldMemberHas !== newMemberHas) {
      if (!newMemberHas) {
        RedisGuildMember.utils.forgetManager(newMember)
          .catch(err => {
            const log = createLogger(oldMember.guild.shard.id)
            log.error(err, `Redis failed to forgetManager after guildMemberUpdate event`)
          })
      } else {
        RedisGuildMember.utils.recognizeManager(newMember)
          .catch(err => {
            const log = createLogger(oldMember.guild.shard.id)
            log.error(err, `Redis failed to recognizeManager after guildMemberUpdate event`)
          })
      }
    }
  }
}
