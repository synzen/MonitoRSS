const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const initAllSources = require('./logic/initialization_optimal.js')

module.exports = (link, rssList, uniqueSettings, callback) => {
  const feedparser = new FeedParser()
  const articleList = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, err => {
    if (err) return callback(err, { status: 'failed', link: link, rssList: rssList })
  })

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    return callback(err, { status: 'failed', link: link, rssList: rssList })
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) articleList.push(item)
  })

  feedparser.on('end', () => {
    if (articleList.length === 0) return callback(null, { status: 'success', link: link })

    initAllSources(rssList, articleList, link, (err, results) => {
      if (err) throw err
      if (results) callback(null, results)
    })
  })
}
