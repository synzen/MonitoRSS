const RedisChannel = require('../structs/db/Redis/Channel.js')
const Feed = require('../structs/db/Feed.js')
const log = require('../util/logger.js')

module.exports = async channel => {
  RedisChannel.utils.forget(channel)
    .catch(err => log.general.error(`Redis failed to forget after channelDelete event`, channel, err))
  const feeds = await Feed.getBy('channel', channel.id)
  feeds.forEach(feed => {
    feed.delete()
      .catch(err => log.general.error('Failed to delete feed after channel deletion', channel.guild, channel, err))
  })
}
