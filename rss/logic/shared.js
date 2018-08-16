const dbCmds = require('../db/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs
const log = require('../../util/logger.js')
const storage = require('../../util/storage.js')
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

module.exports = (data, callback) => {
  const { rssList, articleList, debugFeeds, link, shardId, logicType, config, feedData } = data // feedData is only defined when config.database.uri is set to a databaseless folder path
  if (logicType !== 'init' && logicType !== 'cycle') throw new Error(`Expected logicType parameter must be "cycle" or "init", found ${logicType} instead`)
  const RSSLIST_LENGTH = Object.keys(rssList).length
  let sourcesCompleted = 0
  const totalArticles = articleList.length
  const dbIds = []
  const dbTitles = []
  const dbCustomComparisons = {} // Object with comparison names as key, and array as values whose function is similar to how dbIds and dbTitles work
  const dbCustomComparisonsValid = {} // Object with comparison names as key, and only boolean true values as values
  const dbCustomComparisonsToDelete = []
  const customComparisonsToUpdate = []
  const toInsert = []
  const toUpdate = {} // Article's resolved IDs (getArticleId) as key and the article as value
  const Feed = FeedModel(link, shardId)
  const feedCollectionId = feedData ? storage.collectionId(link, shardId) : undefined
  const feedCollection = feedData ? (feedData[feedCollectionId] || []) : undefined

  dbCmds.findAll(feedCollection || Feed)
    .then(docs => {
      for (var d = 0; d < docs.length; ++d) {
        const doc = docs[d]
        // Push the main data for built in comparisons
        dbIds.push(doc.id)
        dbTitles.push(doc.title)

        // Now deal with custom comparisons
        const docCustomComparisons = doc.customComparisons
        if (docCustomComparisons !== undefined && Object.keys(docCustomComparisons).length > 0) {
          for (var n in docCustomComparisons) { // n = customComparison's name (such as description, author, etc.)
            if (!dbCustomComparisons[n]) dbCustomComparisons[n] = []
            dbCustomComparisons[n].push(docCustomComparisons[n])
          }
        }
      }

      const checkCustomComparisons = Object.keys(dbCustomComparisons).length > 0
      for (var a = 0; a < articleList.length; ++a) {
        const article = articleList[a]
        article._id = getArticleId(articleList, article)
        if (checkCustomComparisons) {
        // Iterate over the values stored in the db, and see if the custom comparison names in the db exist in any of the articles. If they do, then it is marked valid
          for (var compName in dbCustomComparisons) {
            if (article[compName] !== undefined && (typeof article[compName] !== 'object' || article[compName] === null)) dbCustomComparisonsValid[compName] = true
          }
        }
        if (!dbIds.includes(article._id)) toInsert.push(article)
      }

      // If any invalid custom comparisons are found, delete them
      if (checkCustomComparisons) {
        for (var q in dbCustomComparisons) {
          if (!dbCustomComparisonsValid[q]) {
            dbCustomComparisonsToDelete.push(q)
            delete dbCustomComparisons[q]
          }
        }
      }
      dbCmds.bulkInsert(feedCollection || Feed, toInsert).then(() => {
        if (dbIds.length > 0) for (var rssName in rssList) processSource(rssName, docs)
        else callback(null, { status: 'success', link: link, feedCollection: feedCollection, feedCollectionId: feedCollectionId })
      })
        .catch(err => {
          if (err) {
            if (logicType === 'cycle') return callback(new Error(`Database Error: Unable to bulk insert articles for link ${link}`, err.message || err), { status: 'failed', link: link, rssList: rssList })
            else process.exit(1)
          }
        })
    })
    .catch(err => {
      if (logicType === 'cycle') return callback(err, { status: 'failed', link: link, rssList: rssList })
      else process.exit(1)
    })

  function processSource (rssName, docs) {
    const source = rssList[rssName]
    const channelId = source.channel
    const customComparisons = rssList[rssName].customComparisons // Array of names

    if (Array.isArray(customComparisons)) {
      for (var n = customComparisons.length - 1; n >= 0; --n) {
        const name = customComparisons[n]
        if (name === 'title' || name === 'guid' || name === 'pubdate') { // Forbidden custom comparisons since these are already used by the bot
          customComparisons.splice(n, 1)
          continue
        }
        if (!dbCustomComparisons[name] && !customComparisonsToUpdate.includes(name)) customComparisonsToUpdate.push(name) // Since this custom comparison wasn't found in the db, it might be uninitialized or not found in any articles (as checked previously)
      }
    }

    let processedArticles = 0
    if (debugFeeds && debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Processing collection. Total article list length: ${articleList.length}`)

    const maxAge = logicType === 'cycle' ? config.feeds.cycleMaxAge : config.feeds.defaultMaxAge
    const cutoffDay = moment().subtract(maxAge, 'days')

    const globalDateCheck = config.feeds.checkDates != null ? config.feeds.checkDates : defaultConfigs.feeds.checkDates.default
    const localDateCheck = source.checkDates
    const checkDate = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck

    const globalTitleCheck = config.feeds.checkTitles != null ? config.feeds.checkTitles : defaultConfigs.feeds.checkTitles.default
    const localTitleCheck = source.checkTitles
    const checkTitle = typeof globalTitleCheck !== 'boolean' ? globalTitleCheck : localTitleCheck

    for (var a = articleList.length - 1; a >= 0; --a) { // Loop from oldest to newest so the queue that sends articleMessages work properly, sending the older ones first
      const article = articleList[a]
      if (dbIds.length === 0 && articleList.length !== 1) { // Only skip if the articleList length is !== 1, otherwise a feed with only 1 article to send since it may have been the first item added
        if (debugFeeds && debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) due to empty collection.`)
        seenArticle(true, article)
      } else if (dbIds.includes(article._id)) {
        if (debugFeeds && debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), ID was matched.`)
        seenArticle(true, article)
      } else if (checkTitle && dbTitles.includes(article.title)) {
        if (debugFeeds && debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), Title was matched but not ID.`)
        seenArticle(true, article)
      } else if (checkDate && (!article.pubdate || article.pubdate.toString() === 'Invalid Date' || article.pubdate < cutoffDay)) {
        if (debugFeeds && debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), due to date check.`)
        seenArticle(true, article)
      } else {
        if (debugFeeds && debugFeeds.includes(rssName)) log.debug.warning(`${rssName}: Sending article (ID: ${article._id}, TITLE: ${article.title}) to queue for send`)
        seenArticle(false, article)
      }
    }

    function seenArticle (seen, article) {
      if (logicType === 'init' && config.feeds.sendOldMessages !== true) return ++processedArticles === totalArticles ? finishSource() : null // Stops here if it already exists in table, AKA "seen"

      // Check for extra user-specified comparisons
      if (seen) {
        if (!Array.isArray(customComparisons)) return ++processedArticles === totalArticles ? finishSource() : null // Stops here if it already exists in table, AKA "seen"
        for (var z = 0; z < customComparisons.length; ++z) {
          const comparisonName = customComparisons[z]
          const dbCustomComparisonValues = dbCustomComparisons[comparisonName]
          const articleCustomComparisonValue = article[comparisonName]
          if (!dbCustomComparisonValues || dbCustomComparisonValues.includes(articleCustomComparisonValue)) {
            if (debugFeeds && debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) due to custom comparison check for ${comparisonName}`)
            if (debugFeeds && debugFeeds.includes(rssName)) log.debug.info(`${rssName}: (ID: ${article._id}, TITLE: ${article.title}) ${comparisonName} dbCustomComparisonValues: ${dbCustomComparisonValues ? JSON.stringify(dbCustomComparisonValues) : undefined} `)
            continue // The comparison must either be uninitialized or invalid (no such comparison exists in any articles from the request), handled by a previous function. OR it exists in the db
          }

          // Prepare it for update in the database
          if (!toUpdate[article._id]) {
            if (!article.customComparisons) article.customComparisons = {}
            article.customComparisons[comparisonName] = articleCustomComparisonValue
            toUpdate[article._id] = article
          }
          if (debugFeeds && debugFeeds.includes(rssName)) log.debug.info(`${rssName}: Sending article (ID: ${article._id}, TITLE: ${article.title}) due to custom comparison check for ${comparisonName}`)

          return seenArticle(false, article)
        }
        return ++processedArticles === totalArticles ? finishSource() : null
      }

      article.rssName = rssName
      article.discordChannelId = channelId
      callback(null, { status: 'article', article: article })
      return ++processedArticles === totalArticles ? finishSource() : null
    }
  }

  function finishSource () {
    if (++sourcesCompleted === RSSLIST_LENGTH) finishFeed()
  }

  function finishFeed () {
    // Add missing custom comparisons if needed
    if (customComparisonsToUpdate.length > 0) {
      const mustUpdate = customComparisonsToUpdate.length
      for (var l = 0; l < mustUpdate; ++l) {
        const customComparisonName = customComparisonsToUpdate[l]
        for (var a = 0; a < articleList.length; ++a) {
          const article = articleList[a]
          const articleCustomComparisonValue = article[customComparisonName]
          if (articleCustomComparisonValue === undefined || (typeof articleCustomComparisonValue === 'object' && articleCustomComparisonValue !== null)) continue // typeof null returns 'object' even though it's not supposed to
          if (!toUpdate[article._id]) {
            if (!article.customComparisons) article.customComparisons = {}
            article.customComparisons[customComparisonName] = articleCustomComparisonValue
            toUpdate[article._id] = article
          } else toUpdate[article._id].customComparisons[customComparisonName] = articleCustomComparisonValue
        }
      }
    }

    // Update anything if necessary
    const toUpdateLength = Object.keys(toUpdate).length
    if (toUpdateLength === 0) return callback(null, { status: 'success', link: link, feedCollection: feedCollection, feedCollectionId: feedCollectionId })
    let c = 0
    for (var id in toUpdate) {
      const article = toUpdate[id]
      dbCmds.update(feedCollection || Feed, article, err => {
        if (err) {
          if (logicType === 'cycle') log.cycle.error(`Failed to update an article entry`, err)
          else log.init.error(`Failed to update an article entry`, err)
        }
        if (++c === toUpdateLength) callback(null, { status: 'success', link: link, feedCollection: feedCollection, feedCollectionId: feedCollectionId })
      })
    }
  }
}
