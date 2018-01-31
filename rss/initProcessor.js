process.on('uncaughtException', function (err) {
  console.info(err)
  process.send({status: 'fatal', err: err})
  process.exit()
})

const config = require('../config.json')
const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const connectDb = require('./db/connect.js')
const initAllSources = require('./logic/initialization.js')
if (config.logging.logDates === true) require('../util/logDates.js')()
let connected = false

function init (link, rssList, uniqueSettings) {
  const feedparser = new FeedParser()
  const articleList = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined
  let requested = false

  setTimeout(function () {
    if (!requested) {
      try {
        process.send({status: 'failed', link: link, rssList: rssList})
        console.log(`RSS Error! Unable to complete request for link ${link} during initialization, forcing status update to parent process`)
      } catch (e) {}
    }
  }, 180000)

  requestStream(link, cookies, feedparser, function (err) {
    requested = true
    if (err) {
      console.log(`INIT Error: Skipping ${link}\n`, err)
      return process.send({status: 'failed', link: link, rssList: rssList})
    }
  })

  feedparser.on('error', function (err) {
    feedparser.removeAllListeners('end')
    console.log(`INIT Error: Skipping ${link}. (${err})`)
    return process.send({status: 'failed', link: link, rssList: rssList})
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) {
      articleList.push(item)
    }
  })

  feedparser.on('end', function () {
    if (articleList.length === 0) return process.send({status: 'success', link: link})

    initAllSources(rssList, articleList, link, function (err, results) {
      if (err) throw err
      if (results) process.send(results)
    })
  })
}

process.on('message', function (m) {
  if (!connected) {
    connected = true
    connectDb(function (err) {
      if (err) throw new Error(`Could not connect to database for initialization\n`, err)
      init(m.link, m.rssList, m.uniqueSettings)
    })
  } else init(m.link, m.rssList, m.uniqueSettings)
})
