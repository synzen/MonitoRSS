const FilteredFormat = require('../structs/db/FilteredFormat.js')

/**
 * Remove all formats with missing feeds
 * @param {import('../structs/db/Feed.js')[]} feeds
 * @returns {number}
 */
async function pruneFormats (feeds) {
  const filteredFormats = await FilteredFormat.getAll()
  const feedIDs = new Set()
  const feedsLength = feeds.length
  for (var i = feedsLength - 1; i >= 0; --i) {
    feedIDs.add(feeds[i]._id)
  }
  const deletions = []
  const filteredFormatsLength = filteredFormats.length
  for (var j = filteredFormatsLength - 1; j >= 0; --j) {
    const format = filteredFormats[j]
    if (!feedIDs.has(format.feed)) {
      deletions.push(format.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFormats
