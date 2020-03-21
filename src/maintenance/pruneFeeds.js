const Feed = require('../structs/db/Feed.js')
const log = require('../util/logger/create.js')('-')

/**
 * Remove all feeds whose guild doesn't exist
 *
 * Removing feeds will also delete their formats/subscribers
 * according to the Feed.prototype.delete implementation
 * @param {Map<string, number>} guildIdsByShard
 * @param {Map<string, number>} channelIdsByShard
 * @returns {number}
 */
async function pruneFeeds (guildIdsByShard, channelIdsByShard) {
  const feeds = await Feed.getAll()
  const deletions = []
  for (const feed of feeds) {
    const hasGuild = guildIdsByShard.has(feed.guild)
    const hasChannel = channelIdsByShard.has(feed.channel)
    if (!hasGuild || !hasChannel) {
      log.info(`Removing feed ${feed._id} (hasGuild: ${hasGuild}, hasChannel: ${hasChannel})`)
      deletions.push(feed.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFeeds
