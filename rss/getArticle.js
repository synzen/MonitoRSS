const FeedParser = require('feedparser')
const requestStream = require('./request.js')
const storage = require('../util/storage.js')
const Article = require('../structs/Article.js')
const testFilters = require('./translator/filters.js')

module.exports = (guildRss, rssName, passFiltersOnly) => {
  return new Promise((resolve, reject) => {
    const failedLinks = storage.failedLinks
    const rssList = guildRss.sources
    const source = rssList[rssName]

    if (typeof failedLinks[source.link] === 'string') return reject(new Error('Reached connection failure limit'))

    const feedparser = new FeedParser()
    const currentFeed = []
    const cookies = (source.advanced && source.advanced.cookies) ? source.advanced.cookies : undefined

    requestStream(source.link, cookies, feedparser)
      .then(stream => stream.pipe(feedparser))
      .catch(err => {
        err.message = '(Connection failed) ' + err.message
        reject(err)
      })

    feedparser.on('error', err => {
      feedparser.removeAllListeners('end')
      reject(err)
    })

    feedparser.on('readable', function () {
      let item
      do {
        item = this.read()
        if (item) currentFeed.push(item)
      } while (item)
    })

    feedparser.on('end', () => {
      if (currentFeed.length === 0) reject(new Error('No articles in feed to send'))

      if (passFiltersOnly) {
        const filteredCurrentFeed = []

        currentFeed.forEach(article => {
          if (testFilters(guildRss.sources[rssName], new Article(article, guildRss, rssName)).passed) filteredCurrentFeed.push(article) // returns null if no article is sent from passesFilters
        })

        if (filteredCurrentFeed.length === 0) reject(new Error('No articles that pass current filters'))
        else {
          const randFeedIndex = Math.floor(Math.random() * (filteredCurrentFeed.length - 1)) // Grab a random feed from array
          return resolve([ filteredCurrentFeed[randFeedIndex], null, filteredCurrentFeed ])
        }
      } else {
        const randFeedIndex = Math.floor(Math.random() * (currentFeed.length - 1)) // Grab a random feed from array
        const feedLinkList = []
        const rawArticleList = {}
        currentFeed.forEach(article => {
          if (!feedLinkList.includes(article.link)) feedLinkList.push(article.link)
          if (!rawArticleList[article.link]) rawArticleList[article.link] = article
        })
        resolve([ currentFeed[randFeedIndex], feedLinkList, rawArticleList ])
      }
    })
  })
}
