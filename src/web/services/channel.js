const RedisChannel = require('../../structs/db/Redis/Channel.js')

async function getChannel (channelID) {
  const channel = await RedisChannel.fetch(channelID)
  return channel.toJSON()
}

/**
 * @param {string[]} channelIDs
 */
async function getChannels (channelIDs) {
  const promises = []
  for (const id of channelIDs) {
    promises.push(getChannel(id))
  }
  return Promise.all(promises)
}

module.exports = {
  getChannel,
  getChannels
}
