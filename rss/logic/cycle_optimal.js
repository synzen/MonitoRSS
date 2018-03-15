// TODO: Error handling for database operations

const config = require('../../config.json')
const dbCmds = require('../db/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs
// const ArticleModel = require('../../util/storage.js').models.Article
const log = require('../../util/logger.js')
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

module.exports = function (rssList, articleList, debugFeeds, link, callback) {
  let sourcesCompleted = 0
  const toInsert = []
  const Feed = FeedModel(link)

  dbCmds.findAll(Feed, (err, docs) => {
    if (err) return callback(new Error(`Database error: Unable to findAll articles for link ${link}`, err.message || err), { status: 'failed' })
    const oldIds = []

    for (var d = 0; d < docs.length; ++d) oldIds.push(docs[d].id)

    for (var a = 0; a < articleList.length; ++a) {
      const article = articleList[a]
      article._id = getArticleId(articleList, article)
      if (!oldIds.includes(article._id)) toInsert.push(article)
    }

    dbCmds.bulkInsert(Feed, toInsert, (err, res) => {
      if (err) return callback(new Error(`Database Error: Unable to bulk insert articles for link ${link}`, err.message || err), { status: 'failed' })
      if (oldIds.length > 0) for (var rssName in rssList) processSource(rssName, docs)
      else callback(null, { status: 'success', link: link })
    })
  })

  function processSource (rssName, docs) {
    // const Article = ArticleModel(rssName)
    const channelId = rssList[rssName].channel

    let processedArticles = 0
    let totalArticles = 0
    const olderArticles = []
    const newerArticles = []
    if (debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Processing collection. Total article list length: ${articleList.length}`)

    const feedLength = articleList.length - 1
    const cycleMaxAge = config.feeds.cycleMaxAge
    const globalDateCheck = config.feeds.checkDates != null ? config.feeds.checkDates : defaultConfigs.feeds.checkDates.default

    for (var x = feedLength; x >= 0; x--) {
      const article = articleList[x]

      if (article.pubdate && article.pubdate > moment().subtract(cycleMaxAge, 'days')) newerArticles.push(article)
      else {
        let checkDate = globalDateCheck
        const localDateSetting = rssList[rssName].checkDates
        checkDate = typeof localDateSetting !== 'boolean' ? checkDate : localDateSetting

        if (checkDate) {
          olderArticles.push(article) // Mark as old if date checking is enabled
          article._old = true
        } else newerArticles.push(article) // Otherwise mark as new
      }

      ++totalArticles
    }

    let checkTitle = config.feeds.checkTitles != null ? config.feeds.checkTitles : defaultConfigs.feeds.checkTitles.default
    const localTitleSetting = rssList[rssName].checkTitles
    checkTitle = typeof localTitleSetting !== 'boolean' ? checkTitle : localTitleSetting
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
    //   if (err) return callback(new Error(`Database Error: Unable to query find articles for ${rssName}`, err.message || err))
    for (var d = 0; d < docs.length; ++d) {
      const item = docs[d]
      foundIds.push(item.id)
      foundTitles.push(item.title)
    }

    for (var a = 0; a < articleList.length; ++a) {
      const article = articleList[a]
      if (foundIds.length === 0 && articleList.length !== 1) { // Only skip if the articleList length is !== 1, otherwise a feed with only 1 article to send since it may have been the first item added
        if (debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) due to empty collection. Initializing.`)
        seenArticle(false, article, true) // If the collection was uninitialized, initialize all articles without sending
      } else if (foundIds.includes(article._id)) {
        if (debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), ID was matched.`)
        seenArticle(true, article)
      } else if (foundTitles.includes(article.title)) {
        if (debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), Title was matched but not ID. Inserting into collection.`)
        seenArticle(false, article, true) // Don't send to Discord but still insert into collection because it has a unique ID
      } else if (article._old) {
        if (debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), due to date check. Inserting into collection.`)
        seenArticle(false, article, true)
      } else {
        if (debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Sending article (ID: ${article._id}, TITLE: ${article.title}) to sendToDiscord.`)
        seenArticle(false, article)
      }
    }
    // })

    function seenArticle (seen, article, doNotSend) {
      if (seen) return incrementProgress() // Stops here if it already exists in table, AKA "seen"

      if (newerIds.includes(article._id) && !doNotSend) {
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
