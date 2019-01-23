const log = require('../util/logger.js')
const redisOps = require('../util/redisOps.js')

module.exports = member => {
  redisOps.members.forget(member).catch(err => log.general.error(`Redis failed to forget after guildMemberRemove event`, member.guild, member, err))
}
