const FilteredFormat = require('../structs/db/FilteredFormat.js')
const Feed = require('../structs/db/Feed.js')

/**
 * Remove all formats with missing feeds
 * @returns {number}
 */
async function pruneFormats () {
  const [filteredFormats, feeds] = await Promise.all([
    FilteredFormat.getAll(),
    Feed.getAll()
  ])
  const feedIds = new Set(feeds.map(feed => feed._id))
  const deletions = []
  for (const format of filteredFormats) {
    if (!feedIds.has(format.feed)) {
      deletions.push(format.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFormats
