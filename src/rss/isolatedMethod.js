const logLinkErrs = require('../config.js').log.linkErrs
const connectDb = require('./db/connect.js')
const processSources = require('./logic/shared.js')
const log = require('../util/logger.js')
const FeedFetcher = require('../util/FeedFetcher.js')

async function getFeed (data, callback) {
  const { link, rssList, headers } = data
  const linkHeaders = headers[link]
  const fetchOptions = {}
  if (linkHeaders) {
    if (!linkHeaders.lastModified || !linkHeaders.etag) {
      throw new Error(`Headers exist for a link, but missing lastModified and etag (${link})`)
    }
    fetchOptions.headers = {
      'If-Modified-Since': linkHeaders.lastModified,
      'If-None-Match': linkHeaders.etag
    }
  }
  let calledbacked = false
  try {
    const { stream, response } = await FeedFetcher.fetchURL(link, fetchOptions)
    if (response.status === 304) {
      callback()
      return process.send({ status: 'success', link })
    } else {
      const lastModified = response.headers.get('Last-Modified')
      const etag = response.headers.get('ETag')

      if (lastModified && etag) {
        process.send({ status: 'headers', link, lastModified, etag })
      }
    }

    callback()
    calledbacked = true
    const { articleList, idType } = await FeedFetcher.parseStream(stream, link)
    if (articleList.length === 0) return process.send({ status: 'success', link: link })
    processSources({ articleList, useIdType: idType, ...data }, (err, results) => {
      if (err) log.cycle.error(`Cycle logic`, err, true)
      if (results) process.send(results)
    })
  } catch (err) {
    if (logLinkErrs) log.cycle.warning(`Skipping ${link}`, err)
    process.send({ status: 'failed', link: link, rssList: rssList })
    if (!calledbacked) {
      callback()
    }
    calledbacked = true
  }
}

process.on('message', m => {
  const currentBatch = m.currentBatch
  const config = m.config
  const shardId = m.shardId
  const debugFeeds = m.debugFeeds
  const feedData = m.feedData // Only defined if config.database.uri is set to a databaseless folder path
  const scheduleName = m.scheduleName
  const runNum = m.runNum
  const headers = m.headers
  connectDb(true).then(() => {
    const len = Object.keys(currentBatch).length
    let c = 0
    for (var link in currentBatch) {
      const rssList = currentBatch[link]
      let uniqueSettings
      for (var modRssName in rssList) {
        if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
          uniqueSettings = rssList[modRssName].advanced
        }
      }
      getFeed({ link, rssList, uniqueSettings, shardId, debugFeeds, config, feedData, scheduleName, runNum, headers }, () => {
        if (++c === len) process.send({ status: 'batch_connected' })
      })
    }
  }).catch(err => log.general.error(`isolatedMethod db connection`, err))
})
