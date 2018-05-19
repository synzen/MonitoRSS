process.on('uncaughtException', function (err) {
  console.log(err)
  process.send({ status: 'fatal', err: err })
  process.exit()
})

const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const connectDb = require('./db/connect.js')
const initAllSources = require('./logic/initialization.js')
const log = require('../util/logger.js')

function init (data) {
  const { link, rssList, uniqueSettings } = data
  const feedparser = new FeedParser()
  const articleList = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined
  let requested = false

  setTimeout(() => {
    if (!requested) {
      try {
        process.send({ status: 'failed', link: link, rssList: rssList })
        log.cycle.error(`Unable to complete request for link ${link} during initialization, forcing status update to parent process`)
      } catch (e) {}
    }
  }, 180000)

  requestStream(link, cookies, feedparser, err => {
    requested = true
    if (err) {
      log.init.warning(`Skipping ${link}`, err)
      return process.send({status: 'failed', link: link, rssList: rssList})
    }
  })

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    log.init.warning(`Skipping ${link}`, err)
    return process.send({ status: 'failed', link: link, rssList: rssList })
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

    initAllSources({ articleList: articleList, ...data }, (err, results) => {
      if (err) throw err
      if (results) process.send(results)
    })
  })
}

process.on('message', m => {
  const currentBatch = m.currentBatch
  const shardId = m.shardId
  connectDb(err => {
    if (err) throw new Error(`Could not connect to database for initialization\n`, err)
    for (var link in currentBatch) {
      const rssList = currentBatch[link]
      var uniqueSettings
      for (var modRssName in rssList) {
        if (rssList[modRssName].advanced && Object.keys(rssList[modRssName].advanced).length > 0) {
          uniqueSettings = rssList[modRssName].advanced
        }
      }
      init({ link, rssList, uniqueSettings, shardId })
    }
  })
})
