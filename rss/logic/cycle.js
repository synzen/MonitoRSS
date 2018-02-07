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

module.exports = function (rssList, articleList, debugFeeds, link, callback) {
  let sourcesCompleted = 0

  function processSource (rssName) {
    function debug (log) {
      if (!debugFeeds.includes(rssName)) return
      console.log(`DEBUG ${rssName}: ${log}`)
    }

    const Article = ArticleModel(rssName)
    const channelId = rssList[rssName].channel

    let processedArticles = 0
    let totalArticles = 0
    const bulkInsert = []
    const olderArticles = []
    const newerArticles = []
    debug(`Processing collection. Total article list length: ${articleList.length}`)

    const feedLength = articleList.length - 1
    const cycleMaxAge = config.feedSettings.cycleMaxAge
    const globalDateCheck = config.feedSettings.checkDates != null ? config.feedSettings.checkDates : defaultConfigs.feedSettings.checkDates.default

    for (var x = feedLength; x >= 0; x--) {
      articleList[x]._id = getArticleId(articleList, articleList[x])

      if (articleList[x].pubdate && articleList[x].pubdate > moment().subtract(cycleMaxAge, 'days')) newerArticles.push(articleList[x])// checkTable(articleList[x], getArticleId(articleList, articleList[x]))
      else {
        let checkDate = false
        checkDate = globalDateCheck
        const localDateSetting = rssList[rssName].checkDates
        checkDate = typeof localDateSetting !== 'boolean' ? checkDate : localDateSetting

        if (checkDate) {
          olderArticles.push(articleList[x]) // Mark as old if date checking is enabled
          articleList[x]._old = true
        } else newerArticles.push(articleList[x]) // Otherwise mark as new
      }

      ++totalArticles
    }

    let checkTitle = false
    const globalTitleCheck = config.feedSettings.checkTitles != null ? config.feedSettings.checkTitles : defaultConfigs.feedSettings.checkTitles.default
    checkTitle = globalTitleCheck
    const localTitleCheck = rssList[rssName].checkTitles
    checkTitle = typeof localTitleCheck !== 'boolean' ? checkTitle : localTitleCheck
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
      if (err) return callback(new Error(`Database Error: Unable to query find articles for ${rssName}`, err.message || err))
      docs.forEach(item => {
        foundIds.push(item.id)
        foundTitles.push(item.title)
      })

      articleList.forEach(article => {
        if (foundIds.length === 0) {
          debug(`Not sending article (ID: ${article._id}, TITLE: ${article.title}) due to empty collection. Initializing.`)
          seenArticle(false, article, true) // If the collection was uninitialized, initialize all articles without sending
        } else if (foundIds.includes(article._id)) {
          debug(`Not sending article (ID: ${article._id}, TITLE: ${article.title}), ID was matched.`)
          seenArticle(true, article)
        } else if (foundTitles.includes(article.title)) {
          debug(`Not sending article (ID: ${article._id}, TITLE: ${article.title}), Title was matched but not ID. Inserting into collection.`)
          seenArticle(false, article, true) // Don't send to Discord but still insert into collection because it has a unique ID
        } else if (article._old) {
          debug(`Not sending article (ID: ${article._id}, TITLE: ${article.title}), due to date check. Inserting into collection.`)
          seenArticle(false, article, true)
        } else {
          debug(`Sending article (ID: ${article._id}, TITLE: ${article.title}) to sendToDiscord.`)
          seenArticle(false, article)
        }
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

    function incrementProgress () {
      if (++processedArticles !== totalArticles) return
      dbCmds.bulkInsert(Article, bulkInsert, (err, res) => {
        if (err) return callback(new Error(`Database Error: Unable to bulk insert articles for ${rssName}`, err.message || err))
        finishSource()
      })
    }
  }

  for (var rssName in rssList) processSource(rssName) // Per source in one link

  function finishSource () {
    sourcesCompleted++
    if (sourcesCompleted === Object.keys(rssList).length) return callback(null, {status: 'success', link: link})
  }
}
