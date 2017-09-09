/*
  Each batch of link maps (of length batchSize) in a batchList will have a forked rssProcessor
*/
const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const sqlConnect = require('./sql/connect.js')
const logLinkErr = require('../util/logLinkErrs.js')
const processAllSources = require('./logic/rss.js')
if (require('../config.json').logging.logDates === true) require('../util/logDates.js')()
let con

Object.defineProperty(Object.prototype, 'size', {
  value: function () {
    let c = 0
    for (var x in this) if (this.hasOwnProperty(x)) c++
    return c
  },
  enumerable: false,
  writable: true
})

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

    processAllSources(con, rssList, articleList, debugFeeds, link, function (err, results) {
      if (err) console.log(err)
      if (results) process.send(results)
    })
  })
}

process.on('message', function (m) {
  if (!con) {
    con = sqlConnect(function () {
      getFeed(m.link, m.rssList, m.uniqueSettings, m.debugFeeds)
    })
  } else getFeed(m.link, m.rssList, m.uniqueSettings, m.debugFeeds)
})
