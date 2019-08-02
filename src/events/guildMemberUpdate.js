const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'
const log = require('../util/logger.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')

module.exports = (oldMember, newMember) => {
  if (RedisGuildMember.clientExists) {
    const oldMemberHas = oldMember.hasPermission(MANAGE_CHANNELS_PERM)
    const newMemberHas = newMember.hasPermission(MANAGE_CHANNELS_PERM)
    if (oldMemberHas !== newMemberHas) {
      if (!newMemberHas) RedisGuildMember.utils.forgetManager(newMember).catch(err => log.general.error(`Redis failed to forgetManager after guildMemberUpdate event`, newMember.guild, newMember, err))
      else RedisGuildMember.utils.recognizeManager(newMember).catch(err => log.general.error(`Redis failed to recognizeManager after guildMemberUpdate event`, newMember.guild, newMember, err))
    }
  }
}
