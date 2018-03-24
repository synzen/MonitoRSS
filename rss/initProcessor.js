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
let connected = false

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
      log.init.error(`Skipping ${link}`, err)
      return process.send({status: 'failed', link: link, rssList: rssList})
    }
  })

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    log.init.error(`Skipping ${link}`, err)
    return process.send({ status: 'failed', link: link, rssList: rssList })
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) articleList.push(item)
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
  const data = { link: m.link, rssList: m.rssList, uniqueSettings: m.uniqueSettings, shardId: m.shardId }
  if (!connected) {
    connected = true
    connectDb(err => {
      if (err) throw new Error(`Could not connect to database for initialization\n`, err)
      init(data)
    })
  } else init(data)
})
