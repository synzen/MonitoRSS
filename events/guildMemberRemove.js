const log = require('../util/logger.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')

module.exports = member => {
  RedisGuildMember.utils.forget(member).catch(err => log.general.error(`Redis failed to forget after guildMemberRemove event`, member.guild, member, err))
}
