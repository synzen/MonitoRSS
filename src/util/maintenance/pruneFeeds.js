const Feed = require('../../structs/db/Feed.js')

/**
 * Remove all feeds whose guild doesn't exist
 *
 * Removing feeds will also delete their formats/subscribers
 * according to the Feed.prototype.delete implementation
 * @param {Map<string, number>} guildIdsByShard
 * @returns {number}
 */
async function pruneFeeds (guildIdsByShard) {
  const feeds = await Feed.getAll()
  const deletions = []
  for (const feed of feeds) {
    if (!guildIdsByShard.has(feed.guild)) {
      deletions.push(feed.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFeeds
