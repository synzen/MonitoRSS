const log = require('../util/logger.js')
const redisOps = require('../util/redisOps.js')

module.exports = member => {
  redisOps.members.recognize(member).catch(err => log.general.error(`Redis failed to recognize after guildMemberAvailable event`, member.guild, member, err))
}
