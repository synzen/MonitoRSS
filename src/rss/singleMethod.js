const logLinkErrs = require('../config.js').log.linkErrs
const debugFeeds = require('../util/debugFeeds').list
const log = require('../util/logger.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const RequestError = require('../structs/errors/RequestError.js')
const FeedParserError = require('../structs/errors/FeedParserError.js')
const LinkLogic = require('./logic/LinkLogic.js')

module.exports = async (data, callback) => {
  const { link, rssList, uniqueSettings } = data
  try {
    const { articleList, idType } = await FeedFetcher.fetchFeed(link, uniqueSettings)
    if (articleList.length === 0) {
      return callback(null, { status: 'success' })
    }
    const logic = new LinkLogic({ articleList, debugFeeds, useIdType: idType, ...data })
    logic.on('article', article => callback(null, { status: 'article', article }))
    const { feedCollection, feedCollectionId } = await logic.run()
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
