const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const debugFeeds = require('../util/debugFeeds').list
const processAllSources = require('./logic/cycle.js')
const log = require('../util/logger.js')

module.exports = (data, callback) => {
  const { link, rssList, uniqueSettings } = data
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
    do {
      item = this.read()
      if (item) articleList.push(item)
    } while (item)
  })

  feedparser.on('end', () => {
    if (articleList.length === 0) return callback(null, { status: 'success', link: link })

    processAllSources({ articleList: articleList, debugFeeds: debugFeeds, ...data }, (err, results) => {
      if (err) log.cycle.error(`Cycle logic`, err)
      if (results) callback(null, results)
    })
  })
}
