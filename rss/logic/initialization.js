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
    // checkTableExists()
    const olderArticles = []
    const newerArticles = []
    let processedArticles = 0

    const feedLength = articleList.length - 1
    const defaultMaxAge = config.feedSettings.defaultMaxAge && !isNaN(parseInt(config.feedSettings.defaultMaxAge, 10)) ? parseInt(config.feedSettings.defaultMaxAge, 10) : 1

    for (var x = feedLength; x >= 0; x--) { // Get feeds starting from oldest, ending with newest.
      articleList[x]._id = getArticleId(articleList, articleList[x])
      const cutoffDay = (rssList[rssName].maxAge) ? moment().subtract(rssList[rssName].maxAge, 'days') : moment().subtract(defaultMaxAge, 'days')

      if (articleList[x].pubdate >= cutoffDay) newerArticles.push(articleList[x])// checkTable(articleList[x], getArticleId(articleList, articleList[x]))
      else if (articleList[x].pubdate < cutoffDay) {
        olderArticles.push(articleList[x])// checkTable(articleList[x], getArticleId(articleList, articleList[x]), true)
      } else if (articleList[x].pubdate.toString() === 'Invalid Date') {
        let checkDate = false
        const globalSetting = config.feedSettings.checkDates != null ? config.feedSettings.checkDates : defaultConfigs.feedSettings.checkDates.default
        checkDate = globalSetting
        const specificSetting = rssList[rssName].checkDates
        checkDate = typeof specificSetting !== 'boolean' ? checkDate : specificSetting

        if (checkDate) olderArticles.push(articleList[x])// checkTable(articleList[x], getArticleId(articleList, articleList[x]), true) // Mark as old if date checking is enabled
        else newerArticles.push(articleList[x])// checkTable(articleList[x], getArticleId(articleList, articleList[x])) // Otherwise mark it new
      } else olderArticles.push(articleList[x])// checkTable(articleList[x], getArticleId(articleList, articleList[x]), true)
    }

    checkCollection(olderArticles, newerArticles, articleList)

    function checkCollection (olderArticles, newerArticles, allArticles) {
      let checkTitle = false
      const globalSetting = config.feedSettings.checkTitles != null ? config.feedSettings.checkTitles : defaultConfigs.feedSettings.checkTitles.default
      checkTitle = globalSetting
      const specificSetting = rssList[rssName].checkTitles
      checkTitle = typeof specificSetting !== 'boolean' ? checkTitle : specificSetting
      const allIds = []
      const allTitles = []
      const newerIds = []
      olderArticles.forEach(article => {
        allIds.push(article._id)
        if (checkTitle) allTitles.push(article.title)
      })
      newerArticles.forEach(article => {
        allIds.push(article._id)
        newerIds.push(article._id)
        if (checkTitle) allTitles.push(article.title)
      })
      const foundIds = []
      const foundTitles = []

      dbCmds.selectIdsOrTitles(Article, allIds, allTitles, (err, docs) => {
        if (err) return callback(err)
        docs.forEach(item => {
          foundIds.push(item.id)
          foundTitles.push(item.title)
        })

        allArticles.forEach(article => {
          if (foundIds.length === 0) return seenArticle(false, article, true) // If the collection was uninitialized, initialize all articles without sending

          if (foundIds.includes(article._id)) return seenArticle(true, article)
          else if (foundTitles.includes(article.title)) seenArticle(false, article, true)
          else seenArticle(false, article)
        })
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
    }

    function incrementProgress () {
      processedArticles++
      if (processedArticles === totalArticles) {
        dbCmds.bulkInsert(Article, bulkInsert, (err, res) => {
          if (err) return callback(err)
          finishSource()
        })
      }
    }
  }

  for (var rssName in rssList) processSource(rssName)

  function finishSource () {
    sourcesCompleted++
    // if (sourcesCompleted === rssList.size()) return process.send({status: 'success', link: link})
    if (sourcesCompleted === Object.keys(rssList).length) return callback(null, {status: 'success'})
  }
}
