const logLinkErrs = require('../config.json').log.linkErrs
const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const connectDb = require('./db/connect.js')
const processSources = require('./logic/shared.js')
const log = require('../util/logger.js')

function getFeed (data, callback) {
  const { link, rssList, uniqueSettings, logicType } = data
  if (logicType !== 'init' && logicType !== 'cycle') throw new Error(`Expected logicType parameter must be "cycle" or "init", found ${logicType} instead`)
  const feedparser = new FeedParser()
  const articleList = []

  const cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined
  let requested = false

  setTimeout(() => {
    if (!requested) {
      try {
        process.send({ status: 'failed', link: link, rssList: rssList })
        callback()
        if (logicType === 'cycle') log.cycle.error(`Unable to complete request for link ${link} during cycle, forcing status update to parent process`)
        else if (logicType === 'init') log.init.error(`Unable to complete request for link ${link} during initialization, forcing status update to parent process`)
      } catch (e) {}
    }
  }, 90000)

  requestStream(link, cookies, feedparser)
    .then(stream => {
      stream.pipe(feedparser)
      requested = true
      callback()
    })
    .catch(err => {
      if (logicType === 'cycle' && logLinkErrs) log.cycle.warning(`Skipping ${link}`, err)
      else if (logicType === 'init') log.init.warning(`Skipping ${link}`, err)
      process.send({ status: 'failed', link: link, rssList: rssList })
      callback()
    })

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    if (logicType === 'cycle' && logLinkErrs) log.cycle.warning(`Skipping ${link}`, err)
    else if (logicType === 'init') log.init.warning(`Skipping ${link}`, err)
    process.send({ status: 'failed', link: link, rssList: rssList })
  })

  feedparser.on('readable', function () {
    let item
    do {
      item = this.read()
      if (item) articleList.push(item)
    } while (item)
  })

  feedparser.on('end', () => {
    if (articleList.length === 0) return process.send({ status: 'success', link: link })
    processSources({ articleList: articleList, ...data }, (err, results) => {
      if (err) {
        if (logicType === 'cycle') log.cycle.error(`Cycle logic`, err, true)
        else throw err
      }
      if (results) process.send(results)
    })
  })
}

process.on('message', m => {
  const currentBatch = m.currentBatch
  const config = m.config
  const shardId = m.shardId
  const debugFeeds = m.debugFeeds
  const logicType = m.logicType
  const feedData = m.feedData // Only defined if config.database.uri is set to a databaseless folder path
  connectDb().then(() => {
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
      getFeed({ link, rssList, uniqueSettings, shardId, debugFeeds, logicType, config, feedData }, () => {
        if (++c === len) process.send({ status: 'batch_connected' })
      })
    }
  }).catch(err => log.general.error(`isolatedMethod db connection`, err))
})
