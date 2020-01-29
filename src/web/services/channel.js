const RedisChannel = require('../../structs/db/Redis/Channel.js')

async function getCachedChannel (channelID) {
  const channel = await RedisChannel.fetch(channelID)
  return channel ? channel.toJSON() : null
}

/**
 * @param {string[]} channelIDs
 */
async function getCachedChannels (channelIDs) {
  const promises = []
  for (const id of channelIDs) {
    promises.push(getCachedChannel(id))
  }
  return Promise.all(promises)
}

/**
 * @param {string} guildID
 */
async function getGuildChannels (guildID) {
  const channelIDs = await RedisChannel.utils.getChannelsOfGuild(guildID)
  const channels = await Promise.all(channelIDs.map(id => RedisChannel.fetch(id)))
  return channels.map(channel => channel.toJSON())
}

module.exports = {
  getCachedChannel,
  getCachedChannels,
  getGuildChannels
}
