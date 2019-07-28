const Article = require('../structs/Article.js')
const testFilters = require('./translator/filters.js')
const dbOpsFailedLinks = require('../util/db/failedLinks.js')
const FeedFetcher = require('../util/FeedFetcher.js')

module.exports = async (guildRss, rssName, passFiltersOnly) => {
  const rssList = guildRss.sources
  const source = rssList[rssName]
  const failedLinkResult = await dbOpsFailedLinks.get(source.link)
  if (failedLinkResult && failedLinkResult.failed) throw new Error('Reached connection failure limit')
  const { articleList } = await FeedFetcher.fetchFeed(source.link, source.advanced)

  if (passFiltersOnly) {
    const filteredarticleList = []

    for (const article of articleList) {
      const constructedArticle = new Article(article, source, { })
      if (testFilters(guildRss.sources[rssName], constructedArticle).passed) filteredarticleList.push(article) // returns null if no article is sent from passesFilters
    }

    if (filteredarticleList.length === 0) throw new Error('No articles that pass current filters')
    else {
      const randFeedIndex = Math.floor(Math.random() * (filteredarticleList.length - 1)) // Grab a random feed from array
      return [ filteredarticleList[randFeedIndex], null, filteredarticleList ]
    }
  } else {
    const randFeedIndex = Math.round(Math.random() * (articleList.length - 1)) // Grab a random feed from array
    const feedLinkList = []
    const rawArticleList = []
    for (const article of articleList) {
      if (!feedLinkList.includes(article.link)) feedLinkList.push(article.link)
      rawArticleList.push(article)
    }
    return [ articleList[randFeedIndex], feedLinkList, rawArticleList ]
  }
}
