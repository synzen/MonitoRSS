const logLinkErrs = require('../config.js').log.linkErrs
const processSources = require('./logic/shared.js')
const debugFeeds = require('../util/debugFeeds').list
const log = require('../util/logger.js')
const storage = require('../util/storage.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const RequestError = require('../structs/errors/RequestError.js')
const FeedParserError = require('../structs/errors/FeedParserError.js')

module.exports = async (data, callback) => {
  const { link, rssList, uniqueSettings, scheduleName } = data
  try {
    const { articleList, idType } = await FeedFetcher.fetchFeed(link, uniqueSettings)
    if (articleList.length === 0) {
      return callback(null, { status: 'success', link: link })
    }
    const { feedCollection, feedCollectionId } = await processSources({ articleList, debugFeeds, shardId: storage.bot.shard ? storage.bot.shard.id : undefined, scheduleName, useIdType: idType, ...data }, article => callback(null, article))
    callback(null, { status: 'success', feedCollection, feedCollectionId, link })
  } catch (err) {
    if (err instanceof RequestError || err instanceof FeedParserError) {
      if (logLinkErrs) {
        log.cycle.warning(`Skipping ${link}`, err)
      }
    } else {
      log.cycle.error('Cycle logic', err, true)
    }
    callback(err, { status: 'failed', link: link, rssList: rssList })
  }
}
