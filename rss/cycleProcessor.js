/*
  Each batch of link maps (of length batchSize) in a batchList will have a forked rssProcessor
*/
const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const connectDb = require('./db/connect.js')
const logLinkErr = require('../util/logLinkErrs.js')
const processAllSources = require('./logic/rss.js')
if (require('../config.json').logging.logDates === true) require('../util/logDates.js')()
let connected = false

function getFeed (link, rssList, uniqueSettings, debugFeeds) {
  const feedparser = new FeedParser()
  const articleList = []

  const cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined
  let requested = false

  setTimeout(function () {
    if (!requested) {
      try {
        process.send({status: 'failed', link: link, rssList: rssList})
        console.log(`RSS Error: Unable to complete request for link ${link} during cycle, forcing status update to parent process`)
      } catch (e) {}
    }
  }, 90000)

  requestStream(link, cookies, feedparser, function (err) {
    requested = true
    if (!err) return
    logLinkErr({link: link, content: err})
    process.send({status: 'failed', link: link, rssList: rssList})
  })

  feedparser.on('error', function (err) {
    logLinkErr({link: link, content: err})
    process.send({status: 'failed', link: link, rssList: rssList})
    feedparser.removeAllListeners('end')
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) {
      articleList.push(item)
    }
  })

  feedparser.on('end', function () {
    if (articleList.length === 0) return process.send({status: 'success', link: link})

    processAllSources(rssList, articleList, debugFeeds, link, function (err, results) {
      if (err) console.log(err)
      if (results) process.send(results)
    })
  })
}

process.on('message', function (m) {
  if (!connected) {
    connected = true
    connectDb(function (err) {
      if (err) throw new Error(`Could not connect to SQL database for cycle.\n`, err)
      getFeed(m.link, m.rssList, m.uniqueSettings, m.debugFeeds)
    })
  } else getFeed(m.link, m.rssList, m.uniqueSettings, m.debugFeeds)
})
