const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const debugFeeds = require('../util/debugFeeds').list
const processLinkSources = require('./logic/cycle.js')
const log = require('../util/logger.js')

module.exports = (link, rssList, uniqueSettings, callback) => {
  const feedparser = new FeedParser()
  const articleList = []

  const cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, err => {
    if (err) callback(err, { status: 'failed', link: link, rssList: rssList })
  })

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    callback(err, { status: 'failed', link: link, rssList: rssList })
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) {
      articleList.push(item)
    }
  })

  feedparser.on('end', () => {
    if (articleList.length === 0) return callback(null, { status: 'success', link: link })
    let done = 0
    const total = Object.keys(rssList).length

    for (var rssName in rssList) {
      processLinkSources({ rssName: rssName, rssList: rssList, link: link, debugFeeds: debugFeeds, articleList: articleList }, (err, results) => {
        if (err) return log.rss.error(`Cycle logic`, err)
        if (results) callback(null, results) // Could be Articles
        if (++done === total) callback(null, { status: 'success', link: link })
      })
    }
  })
}
