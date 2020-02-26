const Discord = require('discord.js')
const RedisChannel = require('../structs/db/Redis/Channel.js')
const Feed = require('../structs/db/Feed.js')
const createLogger = require('../util/logger/create.js')

module.exports = async channel => {
  if (!(channel instanceof Discord.GuildChannel)) {
    return
  }
  RedisChannel.utils.forget(channel)
    .catch(err => {
      const log = createLogger(channel.guild.shard.id)
      log.error(err, `Redis failed to forget after channelDelete event`)
    })
  const feeds = await Feed.getManyBy('channel', channel.id)
  feeds.forEach(feed => {
    feed.delete()
      .catch(err => {
        const log = createLogger(channel.guild.shard.id)
        log.error(err, 'Failed to delete feed after channel deletion')
      })
  })
}
