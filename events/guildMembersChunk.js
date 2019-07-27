const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const RedisGuildMember = require('../structs/db/Redis/GuildMember.js')

module.exports = (members, guild) => {
  if (storage.redisClient) members.forEach(member => RedisGuildMember.utils.recognize(member).catch(err => log.general.error(`Redis failed to recognize member after guildMembersChunk event`, member.guild, member, err)))
}
