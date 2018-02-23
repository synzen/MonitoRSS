const config = require('../../config.json')
const dbCmds = require('../db/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs
const ArticleModel = require('../../util/storage.js').models.Article

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

  function processSource (rssName) {
    const Article = ArticleModel(rssName)
    const channelId = rssList[rssName].channel
    const bulkInsert = []
    const olderArticles = []
    const newerArticles = []
    let processedArticles = 0

    const feedLength = articleList.length - 1
    const defaultMaxAge = config.feedSettings.defaultMaxAge && !isNaN(parseInt(config.feedSettings.defaultMaxAge, 10)) ? parseInt(config.feedSettings.defaultMaxAge, 10) : 1
    const globalDateCheck = config.feedSettings.checkDates != null ? config.feedSettings.checkDates : defaultConfigs.feedSettings.checkDates.default

    for (var x = feedLength; x >= 0; x--) { // Get feeds starting from oldest, ending with newest.
      articleList[x]._id = getArticleId(articleList, articleList[x])
      const cutoffDay = (rssList[rssName].maxAge) ? moment().subtract(rssList[rssName].maxAge, 'days') : moment().subtract(defaultMaxAge, 'days')

      if (articleList[x].pubdate >= cutoffDay) newerArticles.push(articleList[x])
      else if (articleList[x].pubdate < cutoffDay) {
        olderArticles.push(articleList[x])// checkTable(articleList[x], getArticleId(articleList, articleList[x]), true)
      } else if (articleList[x].pubdate.toString() === 'Invalid Date') {
        let checkDate = globalDateCheck
        const feedSet = rssList[rssName].checkDates
        checkDate = typeof feedSet !== 'boolean' ? checkDate : feedSet

        if (checkDate) olderArticles.push(articleList[x]) // Mark as old if date checking is enabled
        else newerArticles.push(articleList[x]) // Otherwise mark it new
      } else olderArticles.push(articleList[x]) // for all other cases
    }

    let checkTitle = config.feedSettings.checkTitles != null ? config.feedSettings.checkTitles : defaultConfigs.feedSettings.checkTitles.default
    const feedSet = rssList[rssName].checkTitles
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

    dbCmds.selectIdsOrTitles(Article, allIds, allTitles, (err, docs) => {
      if (err) return callback(err)
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
    })

    function seenArticle (seen, article, doNotSend) {
      if (seen) return incrementProgress() // Stops here if it already exists in table, AKA "seen"
      if (config.feedSettings.sendOldMessages === true && newerIds.includes(article._id) && !doNotSend) {
        article.rssName = rssName
        article.discordChannelId = channelId
        callback(null, {status: 'article', article: article})
      }

      bulkInsert.push(article)
      incrementProgress()
    }

    function incrementProgress () {
      if (++processedArticles !== totalArticles) return
      dbCmds.bulkInsert(Article, bulkInsert, (err, res) => {
        if (err) return callback(err)
        finishSource()
      })
    }
  }

  for (var rssName in rssList) processSource(rssName)

  function finishSource () {
    if (++sourcesCompleted === Object.keys(rssList).length) return callback(null, {status: 'success'})
  }
}
