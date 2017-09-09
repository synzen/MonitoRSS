const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const sqlConnect = require('./sql/connect.js')
const sqlCmds = require('./sql/commands.js')
const storage = require('../util/storage.js')
const failedLinks = storage.failedLinks
const passesFilters = require('./translator/translate.js')

module.exports = function (guildRss, rssName, passFiltersOnly, callback) {
  const rssList = guildRss.sources

  if (typeof failedLinks[rssList[rssName].link] === 'string') return callback({type: 'failedLink', content: 'Reached fail limit', feed: rssList[rssName]})
  const feedparser = new FeedParser()
  const currentFeed = []
  const cookies = (rssList[rssName].advanced && rssList[rssName].advanced.cookies) ? rssList[rssName].advanced.cookies : undefined

  requestStream(rssList[rssName].link, cookies, feedparser, function (err) {
    if (err) return callback({type: 'request', content: err, feed: rssList[rssName]})
  })

  feedparser.on('error', function (err) {
    feedparser.removeAllListeners('end')
    return callback({type: 'feedparser', content: err, feed: rssList[rssName]})
  })

  feedparser.on('readable', function () {
    let item

    while (item = this.read()) {
      currentFeed.push(item)
    }
  })

  feedparser.on('end', function () {
    if (currentFeed.length === 0) return callback({type: 'empty', content: 'No existing feeds', feed: rssList[rssName]})

    const con = sqlConnect(getArticle)

    function getArticle () {
      sqlCmds.selectTable(con, rssName, function (err, results) {
        if (err || results.length === 0) {
          if (err) callback({type: 'database', content: err, feed: rssList[rssName]})
          if (results.size() === 0) callback({type: 'deleted', content: `Nonexistent in database`, feed: rssList[rssName]})
          return sqlCmds.end(con, function (err) {
            if (err) throw err
          })
        }

        if (passFiltersOnly) {
          const filteredCurrentFeed = []

          for (var i in currentFeed) if (passesFilters(guildRss, rssName, currentFeed[i], false)) filteredCurrentFeed.push(currentFeed[i]) // returns null if no article is sent from passesFilters

          if (filteredCurrentFeed.length === 0) callback({type: 'feed', content: 'No articles that pass current filters.', feed: rssList[rssName]})
          else {
            const randFeedIndex = Math.floor(Math.random() * (filteredCurrentFeed.length - 1)) // Grab a random feed from array
            callback(false, filteredCurrentFeed[randFeedIndex], null, filteredCurrentFeed)
          }
        } else {
          const randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1)) // Grab a random feed from array
          const feedLinkList = []
          const rawArticleList = {}
          for (var x in currentFeed) {
            if (!feedLinkList.includes(currentFeed[x].link)) feedLinkList.push(currentFeed[x].link)
            if (!rawArticleList[currentFeed[x].link]) rawArticleList[currentFeed[x].link] = currentFeed[x]
          }
          callback(false, currentFeed[randFeedIndex], feedLinkList, rawArticleList)
        }

        return sqlCmds.end(con, function (err) {
          if (err) throw err
        })
      })
    }
  })
}
