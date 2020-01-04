const Format = require('../../structs/db/Format.js')
const Feed = require('../../structs/db/Feed.js')

/**
 * Remove all formats with missing feeds
 * @returns {number}
 */
async function pruneFormats () {
  const [ formats, feeds ] = await Promise.all([
    Format.getAll(),
    Feed.getAll()
  ])
  const feedIds = new Set(feeds.map(feed => feed._id))
  const deletions = []
  for (const format of formats) {
    if (!feedIds.has(format.feed)) {
      deletions.push(format.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFormats
