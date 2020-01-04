const FailCounter = require('../../structs/db/FailCounter.js')
const Feed = require('../../structs/db/Feed.js')

/**
 * Remove all fail counters with URLS that no feed has
 * @returns {number}
 */
async function pruneFailCounters () {
  const [ counters, feeds ] = await Promise.all([
    FailCounter.getAll(),
    Feed.getAll()
  ])

  const activeUrls = new Set(feeds.map(feed => feed.url))
  const deletions = []
  for (const counter of counters) {
    if (!activeUrls.has(counter.url)) {
      deletions.push(counter.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneFailCounters
