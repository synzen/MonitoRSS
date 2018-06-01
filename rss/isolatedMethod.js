if (process.env.initializing !== 'true' && process.env.initializing !== 'false') throw new Error(`Expected processor's environment variable process.env.initializing to be "true" or "false", found ${process.env.initializing} instead`)
const logLinkErrs = require('../config.json').log.linkErrs
const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const connectDb = require('./db/connect.js')
const processAllSources = require('./logic/shared.js') // process.env.initializing === false ? require('./logic/cycle.js') : require('./logic/initialization.js')
const log = require('../util/logger.js')

function getFeed (data, callback) {
  const { link, rssList, uniqueSettings } = data
  const feedparser = new FeedParser()
  const articleList = []

  const cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined
  let requested = false

  setTimeout(() => {
    if (!requested) {
      try {
        process.send({ status: 'failed', link: link, rssList: rssList })
        callback()
        if (process.env.initializing === 'false') log.cycle.error(`Unable to complete request for link ${link} during cycle, forcing status update to parent process`)
        else if (process.env.initializing === 'true') log.init.error(`Unable to complete request for link ${link} during initialization, forcing status update to parent process`)
      } catch (e) {}
    }
  }, 90000)

  requestStream(link, cookies, feedparser, err => {
    requested = true
    callback()
    if (!err) return
    if (process.env.initializing === 'false' && logLinkErrs) log.cycle.warning(`Skipping ${link}`, err)
    else if (process.env.initializing === 'true') log.init.warning(`Skipping ${link}`, err)
    process.send({ status: 'failed', link: link, rssList: rssList })
  })

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    if (process.env.initializing === 'false' && logLinkErrs) log.cycle.warning(`Skipping ${link}`, err)
    else if (process.env.initializing === 'true') log.init.warning(`Skipping ${link}`, err)
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
    if (articleList.length === 0) return process.send({status: 'success', link: link})
    processAllSources({ articleList: articleList, logicType: process.env === 'cycle' ? 'CYCLE' : 'INITIALIZATION', ...data }, (err, results) => {
      if (err) {
        if (process.env.initializing === 'false') log.cycle.error(`Cycle logic`, err)
        else throw err
      }
      if (results) process.send(results)
    })
  })
}

process.on('message', m => {
  const currentBatch = m.currentBatch
  const shardId = m.shardId
  const debugFeeds = m.debugFeeds
  connectDb(err => {
    if (err) throw new Error(`Could not connect to database for cycle.\n`, err)
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
      getFeed({ link, rssList, uniqueSettings, shardId, debugFeeds }, () => {
        if (++c === len) process.send({status: 'batch_connected'})
      })
    }
  })
})
