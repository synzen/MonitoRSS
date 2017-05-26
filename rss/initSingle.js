const requestStream = require('./request.js')
const FeedParser = require('feedparser')
const initAllSources = require('./logic/initialization.js')

module.exports = function (con, link, rssList, uniqueSettings, callback) {
  const feedparser = new FeedParser()
  const articleList = []

  var cookies = (uniqueSettings && uniqueSettings.cookies) ? uniqueSettings.cookies : undefined

  requestStream(link, cookies, feedparser, function (err) {
    if (!err) return
    console.log(`INIT Error: Skipping ${link}. (${err})`)
    return callback({status: 'failed', link: link, rssList: rssList})
  })

  feedparser.on('error', function (err) {
    feedparser.removeAllListeners('end')
    console.log(`INIT Error: Skipping ${link}. (${err})`)
    return callback({status: 'failed', link: link, rssList: rssList})
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) {
      articleList.push(item)
    }
  })

  feedparser.on('end', function () {
    if (articleList.length === 0) return callback({status: 'success', link: link})

    initAllSources(con, rssList, articleList, link, function (err, results) {
      if (err) throw err
      if (results) callback(results)
    })
  })
}
