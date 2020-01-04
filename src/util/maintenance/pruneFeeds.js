const Feed = require('../../structs/db/Feed.js')

/**
 * Remove all feeds whose guild doesn't exist
 *
 * Removing feeds will also delete their formats/subscribers
 * according to the Feed.prototype.delete implementation
 * @param {Set<string>} guildIds
 * @returns {number}
 */
async function pruneFeeds (guildIds) {
  const feeds = await Feed.getAll()
  const deletions = []
  for (const feed of feeds) {
    if (!guildIds.has(feed.guild)) {
      deletions.push(feed.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFeeds
