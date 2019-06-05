const redisOps = require('../util/redisOps.js')
const log = require('../util/logger.js')

module.exports = async (oldChannel, newChannel) => {
  if (oldChannel.name !== newChannel.name) redisOps.channels.updateName(newChannel).catch(err => log.general.error(`Redis failed to update name after channelUpdate event`, newChannel, err))
}
