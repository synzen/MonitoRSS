const processSources = require('./logic/shared.js')
const debugFeeds = require('../util/debugFeeds').list
const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const FeedFetcher = require('../util/FeedFetcher.js')

module.exports = (data, callback) => {
  const { link, rssList, uniqueSettings, scheduleName } = data
  FeedFetcher.fetchFeed(link, uniqueSettings).then(({ articleList, idType }) => {
    if (articleList.length === 0) return callback(null, { status: 'success', link: link })
    processSources({ articleList, debugFeeds, shardId: storage.bot.shard ? storage.bot.shard.id : undefined, scheduleName, useIdType: idType, ...data }, (err, results) => {
      if (err) log.cycle.error(`Cycle logic`, err, true)
      if (results) callback(null, results)
    })
  }).catch(err => {
    callback(err, { status: 'failed', link: link, rssList: rssList })
  })
}
