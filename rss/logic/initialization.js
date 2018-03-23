const config = require('../../config.json')
const dbCmds = require('../db/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs
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
  const { rssList, articleList, link, shardId } = data
  const totalArticles = articleList.length
  let sourcesCompleted = 0
  const dbIds = []
  const dbTitles = []
  const toInsert = []
  const Feed = FeedModel(link, shardId)

  dbCmds.findAll(Feed, (err, docs) => {
    if (err) throw err
    const dbIds = []

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
      if (err) throw err
      if (dbIds.length > 0) for (var rssName in rssList) processSource(rssName, docs)
      else callback(null, { status: 'success', link: link })
    })
  })

  function processSource (rssName, docs) {
    const source = rssList[rssName]
    const channelId = source.channel
    let processedArticles = 0

    const defaultMaxAge = config.feeds.defaultMaxAge && !isNaN(parseInt(config.feeds.defaultMaxAge, 10)) ? parseInt(config.feeds.defaultMaxAge, 10) : 1
    const cutoffDay = source.maxAge ? moment().subtract(source.maxAge, 'days') : moment().subtract(defaultMaxAge, 'days')

    const globalDateCheck = config.feeds.checkDates != null ? config.feeds.checkDates : defaultConfigs.feeds.checkDates.default
    const localDateCheck = source.checkDates
    const checkDate = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck

    const globalTitleCheck = config.feeds.checkTitles != null ? config.feeds.checkTitles : defaultConfigs.feeds.checkTitles.default
    const localTitleCheck = source.checkTitles
    const checkTitle = typeof localTitleCheck !== 'boolean' ? globalTitleCheck : localTitleCheck

    for (var a = 0; a < articleList.length; ++a) {
      const article = articleList[a]
      if (dbIds.length === 0 && dbIds.length !== 1) seenArticle(true) // If the collection was uninitialized, initialize all articles without sending. If it only has 1 article, it's likely that it's the first new article
      else if (dbIds.includes(article._id)) seenArticle(true)
      else if (checkTitle && dbTitles.includes(article.title)) seenArticle(true)
      else if (checkDate && (!article.pubdate || article.pubdate.toString() === 'Invalid Date' || article.pubdate < cutoffDay)) seenArticle(true)
      else seenArticle(false, article)
    }

    function seenArticle (seen, article) {
      if (seen || config.feeds.sendOldMessages !== true) return ++processedArticles === totalArticles ? finishSource() : null // Stops here if it already exists in table, AKA "seen"
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
