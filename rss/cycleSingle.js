const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const debugFeeds = require('../util/debugFeeds').list
const processAllSources = require('./logic/rss.js')

module.exports = function (con, link, rssList, uniqueSettings, callback) {
  const feedparser = new FeedParser()
  const articleList = []

  const cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, function (err) {
    if (err) callback(err, {status: 'failed', link: link, rssList: rssList})
  })

  feedparser.on('error', function (err) {
    feedparser.removeAllListeners('end')
    callback(err, {status: 'failed', link: link, rssList: rssList})
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) {
      articleList.push(item)
    }
  })

  feedparser.on('end', function () {
    if (articleList.length === 0) return callback(null, {status: 'success', link: link})

    processAllSources(con, rssList, articleList, debugFeeds, link, function (err, results) {
      if (err) console.log(err)
      if (results) callback(null, results)
    })
  })
}
