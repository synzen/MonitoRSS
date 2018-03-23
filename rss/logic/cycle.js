// TODO: Error handling for database operations

const config = require('../../config.json')
const dbCmds = require('../db/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs
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

module.exports = function (data, callback) {
  const { rssList, articleList, debugFeeds, link, shardId } = data
  let sourcesCompleted = 0
  const totalArticles = articleList.length
  const dbIds = []
  const dbTitles = []
  const toInsert = []
  const Feed = FeedModel(link, shardId)

  dbCmds.findAll(Feed, (err, docs) => {
    if (err) return callback(new Error(`Database error: Unable to findAll articles for link ${link}`, err.message || err), { status: 'failed', link: link, rssList: rssList })

    for (var d = 0; d < docs.length; ++d) {
      dbIds.push(docs[d].id)
      dbTitles.push(docs[d].title)
    }

    for (var a = 0; a < articleList.length; ++a) {
      const article = articleList[a]
      article._id = getArticleId(articleList, article)
      if (!dbIds.includes(article._id)) toInsert.push(article)
    }

    dbCmds.bulkInsert(Feed, toInsert, (err, res) => {
      if (err) return callback(new Error(`Database Error: Unable to bulk insert articles for link ${link}`, err.message || err), { status: 'failed', link: link, rssList: rssList })
      if (dbIds.length > 0) for (var rssName in rssList) processSource(rssName, docs)
      else callback(null, { status: 'success', link: link })
    })
  })

  function processSource (rssName, docs) {
    const source = rssList[rssName]
    const channelId = source.channel

    let processedArticles = 0
    if (debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Processing collection. Total article list length: ${articleList.length}`)

    const cycleMaxAge = config.feeds.cycleMaxAge

    const globalDateCheck = config.feeds.checkDates != null ? config.feeds.checkDates : defaultConfigs.feeds.checkDates.default
    const localDateCheck = source.checkDates
    const checkDate = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck

    const globalTitleCheck = config.feeds.checkTitles != null ? config.feeds.checkTitles : defaultConfigs.feeds.checkTitles.default
    const localTitleCheck = source.checkTitles
    const checkTitle = typeof globalTitleCheck !== 'boolean' ? globalTitleCheck : localTitleCheck

    for (var a = 0; a < articleList.length; ++a) {
      const article = articleList[a]
      if (dbIds.length === 0 && articleList.length !== 1) { // Only skip if the articleList length is !== 1, otherwise a feed with only 1 article to send since it may have been the first item added
        if (debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) due to empty collection.`)
        seenArticle(true)
      } else if (dbIds.includes(article._id)) {
        if (debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), ID was matched.`)
        seenArticle(true)
      } else if (checkTitle && dbTitles.includes(article.title)) {
        if (debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), Title was matched but not ID.`)
        seenArticle(true)
      } else if (checkDate && (!article.pubdate || article.pubdate.toString() === 'Invalid Date' || article.pubdate <= moment().subtract(cycleMaxAge, 'days'))) {
        if (debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), due to date check.`)
        seenArticle(true)
      } else {
        if (debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Sending article (ID: ${article._id}, TITLE: ${article.title}) to sendToDiscord.`)
        seenArticle(false, article)
      }
    }

    function seenArticle (seen, article) {
      if (seen) return ++processedArticles === totalArticles ? finishSource() : null // Stops here if it already exists in table, AKA "seen"
      article.rssName = rssName
      article.discordChannelId = channelId
      callback(null, { status: 'article', article: article })
      return ++processedArticles === totalArticles ? finishSource() : null
    }
  }

  function finishSource () {
    if (++sourcesCompleted === Object.keys(rssList).length) callback(null, { status: 'success', link: link })
  }
}
