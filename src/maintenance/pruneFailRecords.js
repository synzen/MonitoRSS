const FailRecord = require('../structs/db/FailRecord.js')
const Feed = require('../structs/db/Feed.js')

/**
 * Remove all fail records with URLS that no feed has
 * @returns {number}
 */
async function pruneFailRecords () {
  const [records, feeds] = await Promise.all([
    FailRecord.getAll(),
    Feed.getAll()
  ])

  const activeUrls = new Set(feeds.map(feed => feed.url))
  const deletions = []
  for (const record of records) {
    if (!activeUrls.has(record.url)) {
      deletions.push(record.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFailRecords
