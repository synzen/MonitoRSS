const Discord = require('discord.js')
const Feed = require('../structs/db/Feed.js')
const createLogger = require('../util/logger/create.js')
const maintenance = require('../maintenance/index.js')

module.exports = async (oldChannel, newChannel) => {
  if (!(newChannel instanceof Discord.GuildChannel) || !(oldChannel instanceof Discord.GuildChannel)) {
    return
  }
  const log = createLogger(oldChannel.guild.shard.id)
  try {
    const feeds = await Feed.getManyBy('channel', newChannel.id)
    for (const feed of feeds) {
      if (newChannel.deleted) {
        feed.delete()
          .catch(err => log.error(err, 'Failed to delete due to deleted channel'))
      } else {
        maintenance.checkPermissions.feed(feed, newChannel.client)
          .catch(err => log.error(err, `Failed to check permissions of feed ${feed._id} after channel update`))
      }
    }
  } catch (err) {
    log.error(err, 'Failed to check feeds in channelUpdate')
  }
}
