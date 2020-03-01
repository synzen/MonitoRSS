const Discord = require('discord.js')
const Feed = require('../structs/db/Feed.js')
const RedisChannel = require('../structs/db/Redis/Channel.js')
const createLogger = require('../util/logger/create.js')
const maintenance = require('../maintenance/index.js')

module.exports = async (oldChannel, newChannel) => {
  if (!(newChannel instanceof Discord.GuildChannel) || !(oldChannel instanceof Discord.GuildChannel)) {
    return
  }
  if (oldChannel.name !== newChannel.name) {
    RedisChannel.utils.update(oldChannel, newChannel)
      .catch(err => {
        const log = createLogger(oldChannel.guild.shard.id)
        log.error(err, `Redis failed to update name after channelUpdate event`)
      })
  }
  try {
    const feeds = await Feed.getManyBy('channel', newChannel.id)
    const log = createLogger(oldChannel.guild.shard.id)
    for (const feed of feeds) {
      maintenance.checkPermissions.feed(feed, newChannel.client)
        .catch(err => log.error(err, `Failed to check permissions of feed ${feed._id} after channel update`))
    }
  } catch (err) {

  }
}
