const RedisChannel = require('../../structs/db/Redis/Channel.js')

/**
 * @param {string} channelID
 */
async function getCachedChannel (channelID) {
  const channel = await RedisChannel.fetch(channelID)
  return channel ? channel.toJSON() : null
}

/**
 * @param {string} guildID
 */
async function getGuildChannels (guildID) {
  const channelIDs = await RedisChannel.utils.getChannelsOfGuild(guildID)
  const channels = await Promise.all(channelIDs.map(id => getCachedChannel(id)))
  return channels.filter(c => c)
}

module.exports = {
  getCachedChannel,
  getGuildChannels
}
