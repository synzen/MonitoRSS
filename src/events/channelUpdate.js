const RedisChannel = require('../structs/db/Redis/Channel.js')
const log = require('../util/logger.js')

module.exports = async (oldChannel, newChannel) => {
  if (oldChannel.name !== newChannel.name) RedisChannel.utils.update(oldChannel, newChannel).catch(err => log.general.error(`Redis failed to update name after channelUpdate event`, newChannel, err))
}
