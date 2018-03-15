const config = require('../../config.json')
const dbCmds = require('../db/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs
// const ArticleModel = require('../../util/storage.js').models.Article
const FeedModel = require('../../util/storage.js').models.Feed

function getArticleId (articleList, article) {
  let equalGuids = (articleList.length > 1) // default to true for most feeds
  if (equalGuids && articleList[0].guid) {
    articleList.forEach((article, index) => {
      if (index > 0 && article.guid !== articleList[index - 1].guid) equalGuids = false
    })
  }

  if ((!article.guid || equalGuids) && article.title) return article.title
  if ((!article.guid || equalGuids) && !article.title && article.pubdate && article.pubdate.toString() !== 'Invalid Date') return article.pubdate
  return article.guid
}

module.exports = function (rssList, articleList, link, callback) {
  const totalArticles = articleList.length
  let sourcesCompleted = 0
  const toInsert = []
  const Feed = FeedModel(link)

  dbCmds.findAll(Feed, (err, docs) => {
    if (err) throw err // return callback(err)
    const oldIds = []

    for (var d = 0; d < docs.length; ++d) oldIds.push(docs[d].id)

    for (var a = 0; a < articleList.length; ++a) {
      const article = articleList[a]
      article._id = getArticleId(articleList, article)
      if (!oldIds.includes(article._id)) toInsert.push(article)
    }

    dbCmds.bulkInsert(Feed, toInsert, (err, res) => {
      if (err) throw err// return callback(err)
      if (oldIds.length > 0) for (var rssName in rssList) processSource(rssName, docs)
      else callback(null, { status: 'success', link: link })
    })
  })

  function processSource (rssName, docs) {
    // const Article = ArticleModel(rssName)
    const source = rssList[rssName]
    const channelId = source.channel
    const olderArticles = []
    const newerArticles = []
    let processedArticles = 0

    const feedLength = articleList.length - 1
    const defaultMaxAge = config.feeds.defaultMaxAge && !isNaN(parseInt(config.feeds.defaultMaxAge, 10)) ? parseInt(config.feeds.defaultMaxAge, 10) : 1
    const globalDateCheck = config.feeds.checkDates != null ? config.feeds.checkDates : defaultConfigs.feeds.checkDates.default

    for (var x = feedLength; x >= 0; x--) { // Get feeds starting from oldest, ending with newest.
      // articleList[x]._id = getArticleId(articleList, articleList[x])
      const article = articleList[x]
      const cutoffDay = source.maxAge ? moment().subtract(source.maxAge, 'days') : moment().subtract(defaultMaxAge, 'days')

      if (article.pubdate >= cutoffDay) newerArticles.push(article)
      else if (article.pubdate < cutoffDay) {
        olderArticles.push(article)
      } else if (article.pubdate.toString() === 'Invalid Date') {
        let checkDate = globalDateCheck
        const feedSet = source.checkDates
        checkDate = typeof feedSet !== 'boolean' ? checkDate : feedSet

        if (checkDate) olderArticles.push(article) // Mark as old if date checking is enabled
        else newerArticles.push(article) // Otherwise mark it new
      } else olderArticles.push(article) // for all other cases
    }

    let checkTitle = config.feeds.checkTitles != null ? config.feeds.checkTitles : defaultConfigs.feeds.checkTitles.default
    const feedSet = source.checkTitles
    checkTitle = typeof feedSet !== 'boolean' ? checkTitle : feedSet
    const allIds = []
    const allTitles = []
    const newerIds = []
    for (var o = 0; o < olderArticles.length; ++o) {
      const article = olderArticles[o]
      allIds.push(article._id)
      if (checkTitle) allTitles.push(article.title)
    }
    for (var n = 0; n < newerArticles.length; ++n) {
      const article = newerArticles[n]
      allIds.push(article._id)
      newerIds.push(article._id)
      if (checkTitle) allTitles.push(article.title)
    }
    const foundIds = []
    const foundTitles = []

    // dbCmds.selectIdsOrTitles(Article, allIds, allTitles, (err, docs) => {
    // if (err) return callback(err)
    for (var d = 0; d < docs.length; ++d) {
      const item = docs[d]
      foundIds.push(item.id)
      foundTitles.push(item.title)
    }
    for (var a = 0; a < articleList.length; ++a) {
      const article = articleList[a]
      if (foundIds.length === 0) seenArticle(false, article, true) // If the collection was uninitialized, initialize all articles without sending
      else if (foundIds.includes(article._id)) seenArticle(true, article)
      else if (foundTitles.includes(article.title)) seenArticle(false, article, true)
      else seenArticle(false, article)
    }
    // })

    function seenArticle (seen, article, doNotSend) {
      if (seen) return incrementProgress() // Stops here if it already exists in table, AKA "seen"
      if (config.feeds.sendOldMessages === true && newerIds.includes(article._id) && !doNotSend) {
        article.rssName = rssName
        article.discordChannelId = channelId
        callback(null, { status: 'article', article: article })
      }
      incrementProgress()
    }

    function incrementProgress () {
      if (++processedArticles === totalArticles) finishSource()
    }
  }

  function finishSource () {
    if (++sourcesCompleted === Object.keys(rssList).length) callback(null, { status: 'success', link: link })
  }
}
