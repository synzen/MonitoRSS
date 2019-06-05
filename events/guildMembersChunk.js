const log = require('../util/logger.js')
const redisOps = require('../util/redisOps.js')

module.exports = (members, guild) => {
  if (redisOps.client.exists()) members.forEach(member => redisOps.members.recognize(member).catch(err => log.general.error(`Redis failed to recognize member after guildMembersChunk event`, member.guild, member, err)))
}
