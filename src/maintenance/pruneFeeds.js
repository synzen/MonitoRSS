const log = require('../util/logger/create.js')('-')

/**
 * Remove all feeds whose guild doesn't exist
 *
 * Removing feeds will also delete their formats/subscribers
 * according to the Feed.prototype.delete implementation
 * @param {import('../structs/db/Feed.js')[]} feeds
 * @param {Map<string, number>} guildIdsByShard
 * @param {Map<string, number>} channelIdsByShard
 * @returns {number}
 */
async function pruneFeeds (feeds, guildIdsByShard, channelIdsByShard) {
  const deletions = []
  const length = feeds.length
  for (var i = length - 1; i >= 0; --i) {
    const feed = feeds[i]
    const hasGuild = guildIdsByShard.has(feed.guild)
    const hasChannel = channelIdsByShard.has(feed.channel)
    if (!hasGuild || !hasChannel) {
      log.info(`Removing feed ${feed._id} (hasGuild: ${hasGuild}, hasChannel: ${hasChannel})`)
      deletions.push(feed.delete())
      feeds.splice(i, 1)
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFeeds
