const requestStream = require('./request.js')
const Article = require('../structs/Article.js')
const DecodedFeedParser = require('../structs/DecodedFeedParser.js')
const testFilters = require('./translator/filters.js')
const dbOps = require('../util/dbOps.js')

module.exports = async (guildRss, rssName, passFiltersOnly) => {
  const rssList = guildRss.sources
  const source = rssList[rssName]
  const failedLinkResult = await dbOps.failedLinks.get(source.link)
  if (failedLinkResult && failedLinkResult.failed) throw new Error('Reached connection failure limit')
  const feedparser = new DecodedFeedParser(null, source.link)
  const currentFeed = []
  const cookies = (source.advanced && source.advanced.cookies) ? source.advanced.cookies : undefined

  try {
    const stream = await requestStream(source.link, cookies, feedparser)
    stream.pipe(feedparser)
  } catch (err) {
    err.message = '(Connection failed) ' + err.message
    throw err
  }

  return new Promise((resolve, reject) => {
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
          const constructedArticle = new Article(article, source, { })
          if (testFilters(guildRss.sources[rssName], constructedArticle).passed) filteredCurrentFeed.push(article) // returns null if no article is sent from passesFilters
        })

        if (filteredCurrentFeed.length === 0) reject(new Error('No articles that pass current filters'))
        else {
          const randFeedIndex = Math.floor(Math.random() * (filteredCurrentFeed.length - 1)) // Grab a random feed from array
          return resolve([ filteredCurrentFeed[randFeedIndex], null, filteredCurrentFeed ])
        }
      } else {
        const randFeedIndex = Math.round(Math.random() * (currentFeed.length - 1)) // Grab a random feed from array
        const feedLinkList = []
        const rawArticleList = []
        currentFeed.forEach(article => {
          if (!feedLinkList.includes(article.link)) feedLinkList.push(article.link)
          rawArticleList.push(article)
        })
        resolve([ currentFeed[randFeedIndex], feedLinkList, rawArticleList ])
      }
    })
  })
}
