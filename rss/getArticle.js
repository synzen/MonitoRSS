const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const storage = require('../util/storage.js')
const Article = require('../structs/Article.js')
const testFilters = require('./translator/filters.js')

module.exports = (guildRss, rssName, passFiltersOnly, callback) => {
  const failedLinks = storage.failedLinks
  const rssList = guildRss.sources
  const source = rssList[rssName]

  if (typeof failedLinks[source.link] === 'string') {
    const err = new Error('Reached connection failure limit')
    err.type = 'failedLink'
    err.feed = source
    return callback(err)
  }
  const feedparser = new FeedParser()
  const currentFeed = []
  const cookies = (source.advanced && source.advanced.cookies) ? source.advanced.cookies : undefined

  requestStream(source.link, cookies, feedparser, err => {
    if (err) {
      err.type = 'request'
      err.feed = source
      return callback(err)
    }
  })

  feedparser.on('error', err => {
    feedparser.removeAllListeners('end')
    err.type = 'feedparser'
    err.feed = source
    return callback(err)
  })

  feedparser.on('readable', function () {
    let item
    do {
      item = this.read()
      if (item) currentFeed.push(item)
    } while (item)
  })

  feedparser.on('end', () => {
    if (currentFeed.length === 0) {
      const err = new Error('No articles in feed to send')
      err.type = 'empty'
      err.feed = source
      return callback(err)
    }

    if (passFiltersOnly) {
      const filteredCurrentFeed = []

      currentFeed.forEach(article => {
        if (testFilters(guildRss.sources[rssName], new Article(article, guildRss, rssName)).passed) filteredCurrentFeed.push(article) // returns null if no article is sent from passesFilters
      })

      if (filteredCurrentFeed.length === 0) {
        const err = new Error('No articles that pass current filters')
        err.type = 'feed'
        err.feed = source
        return callback(err)
      } else {
        const randFeedIndex = Math.floor(Math.random() * (filteredCurrentFeed.length - 1)) // Grab a random feed from array
        return callback(null, filteredCurrentFeed[randFeedIndex], null, filteredCurrentFeed)
      }
    } else {
      const randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1)) // Grab a random feed from array
      const feedLinkList = []
      const rawArticleList = {}
      currentFeed.forEach(article => {
        if (!feedLinkList.includes(article.link)) feedLinkList.push(article.link)
        if (!rawArticleList[article.link]) rawArticleList[article.link] = article
      })
      callback(null, currentFeed[randFeedIndex], feedLinkList, rawArticleList)
    }
  })
}
