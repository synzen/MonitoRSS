const log = require('../util/logger.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')

module.exports = member => {
  RedisGuildMember.utils.recognize(member).catch(err => log.general.error(`Redis failed to recognize after guildMemberAvailable event`, member.guild, member, err))
}
