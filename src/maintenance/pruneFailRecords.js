const FailRecord = require('../structs/db/FailRecord.js')

/**
 * Remove all fail records with URLS that no feed has
 * @param {import('../structs/db/Feed.js')[]} feeds
 * @returns {number}
 */
async function pruneFailRecords (feeds) {
  const records = await FailRecord.getAll()
  const feedsLength = feeds.length
  const activeURLs = new Set()
  for (var i = feedsLength - 1; i >= 0; --i) {
    activeURLs.add(feeds[i].url)
  }
  const deletions = []
  const recordsLength = records.length
  for (var j = recordsLength - 1; j >= 0; --j) {
    const record = records[j]
    if (!activeURLs.has(record._id)) {
      deletions.push(record.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFailRecords
