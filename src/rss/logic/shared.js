const dbCmds = require('../db/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/checkConfig.js').defaultConfigs
const log = require('../../util/logger.js')
const Article = require('../../models/Article.js')
const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')

function formatCallbackArticle (article, source, rssName, callbackFunc) {
  // For ArticleMessage to access once ScheduleManager receives this article
  article._delivery = {
    guildId: source.guildId, // Originally set in source through FeedSchedule.js
    dateSettings: source.dateSettings, // Not the actual date, but settings concerning date format/language/timezone. Originally set in source through FeedSchedule.js
    rssName,
    channelId: source.channel,
    source
  }

  callbackFunc({ status: 'article', article })
}

module.exports = async (data, callbackArticle) => {
  const { rssList, articleList, debugFeeds, link, shardId, config, feedData, scheduleName, runNum, useIdType } = data // feedData is only defined when config.database.uri is set to a databaseless folder path
  if (!scheduleName) throw new Error('Missing schedule name for shared logic')
  const totalArticles = articleList.length
  const dbIds = new Set()
  const dbTitles = new Set()
  const dbCustomComparisons = {} // Object with comparison names as key, and array as values whose function is similar to how dbIds and dbTitles work
  const dbCustomComparisonsValid = {} // Object with comparison names as key, and only boolean true values as values
  const dbCustomComparisonsToDelete = []
  const customComparisonsToUpdate = []
  const toInsert = []
  const toUpdate = {} // Article's resolved IDs as key and the article as value
  const collectionID = Article.getCollectionID(link, shardId, scheduleName)
  const Feed = Article.modelByID(collectionID)
  const feedCollectionId = feedData ? collectionID : undefined
  const feedCollection = feedData ? (feedData[feedCollectionId] || []) : undefined

  const docs = await dbCmds.findAll(feedCollection || Feed)
  for (const doc of docs) {
    // Push the main data for built in comparisons
    dbIds.add(doc.id)
    dbTitles.add(doc.title)

    // Now deal with custom comparisons
    const docCustomComparisons = doc.customComparisons
    if (docCustomComparisons !== undefined && Object.keys(docCustomComparisons).length > 0) {
      for (const n in docCustomComparisons) { // n = customComparison's name (such as description, author, etc.)
        if (!dbCustomComparisons[n]) {
          dbCustomComparisons[n] = [docCustomComparisons[n]]
        } else {
          dbCustomComparisons[n].push(docCustomComparisons[n])
        }
      }
    }
  }

  const checkCustomComparisons = Object.keys(dbCustomComparisons).length > 0
  for (const article of articleList) {
    article._id = ArticleIDResolver.getIDTypeValue(article, useIdType)
    if (checkCustomComparisons) {
    // Iterate over the values stored in the db, and see if the custom comparison names in the db exist in any of the articles. If they do, then it is marked valid
      for (const compName in dbCustomComparisons) {
        if (article[compName] !== undefined && (typeof article[compName] !== 'object' || article[compName] === null)) {
          dbCustomComparisonsValid[compName] = true
        }
      }
    }
    if (!dbIds.has(article._id)) {
      toInsert.push(article)
    }
  }

  // If any invalid custom comparisons are found, delete them
  if (checkCustomComparisons) {
    for (const q in dbCustomComparisons) {
      if (!dbCustomComparisonsValid[q]) {
        dbCustomComparisonsToDelete.push(q)
        delete dbCustomComparisons[q]
      }
    }
  }
  await dbCmds.bulkInsert(feedCollection || Feed, toInsert)
  if (dbIds.size === 0) {
    return { status: 'success', link, feedCollection, feedCollectionId }
  }
  for (const rssName in rssList) {
    const source = rssList[rssName]
    const toDebug = debugFeeds && debugFeeds.includes(rssName)
    const customComparisons = source.customComparisons // Array of names
    const sentTitles = new Set()

    if (Array.isArray(customComparisons)) {
      for (let n = customComparisons.length - 1; n >= 0; --n) {
        const name = customComparisons[n]
        if (name === 'title' || name === 'guid' || name === 'pubdate') { // Forbidden custom comparisons since these are already used by the bot
          customComparisons.splice(n, 1)
          continue
        }
        if (!dbCustomComparisons[name] && !customComparisonsToUpdate.includes(name)) {
          customComparisonsToUpdate.push(name) // Since this custom comparison wasn't found in the db, it might be uninitialized or not found in any articles (as checked previously)
        }
      }
    }

    if (toDebug) {
      log.debug.info(`${rssName}: Processing collection. Total article list length: ${totalArticles}`)
    }

    const maxAge = config.feeds.cycleMaxAge
    const cutoffDay = moment().subtract(maxAge, 'days')

    const globalDateCheck = config.feeds.checkDates != null ? config.feeds.checkDates : defaultConfigs.feeds.checkDates.default
    const localDateCheck = source.checkDates
    const checkDate = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck

    const globalTitleCheck = config.feeds.checkTitles != null ? config.feeds.checkTitles : defaultConfigs.feeds.checkTitles.default
    const localTitleCheck = source.checkTitles
    const checkTitle = typeof globalTitleCheck !== 'boolean' ? globalTitleCheck : localTitleCheck

    if (toDebug) {
      log.debug.info('Database IDs:', JSON.stringify(Array.from(dbIds)))
      log.debug.info('Database Titles:', JSON.stringify(Array.from(dbTitles)))
    }
    for (let a = totalArticles - 1; a >= 0; --a) { // Loop from oldest to newest so the queue that sends articleMessages work properly, sending the older ones first
      const article = articleList[a]
      const notInitialized = dbIds.size === 0 && totalArticles !== 1
      const matchedID = dbIds.has(article._id)
      const matchedTitle = checkTitle && (dbTitles.has(article.title) || sentTitles.has(article.title))
      const matchedDate = checkDate && ((!article.pubdate || article.pubdate.toString() === 'Invalid Date') || (article.pubdate && article.pubdate.toString() !== 'Invalid Date' && article.pubdate < cutoffDay))
      let seen = false
      if (notInitialized || matchedID || matchedTitle || matchedDate) {
        if (toDebug) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) Matched ${notInitialized ? 'init case' : matchedID ? 'ID' : matchedTitle ? 'title' : matchedDate ? 'date' : 'UNKNOWN CASE'}.`)
        seen = true
      } else if (checkTitle && article.title) {
        sentTitles.add(article.title)
      }

      if (runNum === 0 && config.feeds.sendOldOnFirstCycle === false) {
        if (debugFeeds && debugFeeds.includes(rssName)) {
          log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), config.feeds.sendOldOnFirstCycle is false`)
        }
        continue
      }

      // Check for extra user-specified comparisons
      if (!seen) {
        formatCallbackArticle(article, source, rssName, callbackArticle)
        continue
      }
      if (!Array.isArray(customComparisons)) {
        continue
      }
      for (const comparisonName of customComparisons) {
        const dbCustomComparisonValues = dbCustomComparisons[comparisonName] // Might be an array of descriptions, authors, etc.
        const articleCustomComparisonValue = article[comparisonName]
        if (!dbCustomComparisonValues || dbCustomComparisonValues.includes(articleCustomComparisonValue) || !articleCustomComparisonValue) {
          if (debugFeeds && debugFeeds.includes(rssName)) {
            log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) due to custom comparison check for ${comparisonName}${!articleCustomComparisonValue ? ' (No article value for custom comparison field)' : ''}`)
          }
          if (debugFeeds && debugFeeds.includes(rssName)) {
            log.debug.info(`${rssName}: (ID: ${article._id}, TITLE: ${article.title}) ${comparisonName} dbCustomComparisonValues: ${dbCustomComparisonValues ? JSON.stringify(dbCustomComparisonValues) : undefined} `)
          }
          continue // The comparison must either be uninitialized or invalid (no such comparison exists in any articles from the request), handled by a previous function. OR it exists in the db
        }

        // Prepare it for update in the database
        if (!toUpdate[article._id]) {
          if (!article.customComparisons) article.customComparisons = {}
          article.customComparisons[comparisonName] = articleCustomComparisonValue
          toUpdate[article._id] = article
        }
        if (debugFeeds && debugFeeds.includes(rssName)) {
          log.debug.info(`${rssName}: Sending article (ID: ${article._id}, TITLE: ${article.title}) due to custom comparison check for ${comparisonName}`)
        }
        formatCallbackArticle(article, source, rssName, callbackArticle)
      }
    }
  }

  const mustUpdate = customComparisonsToUpdate.length
  for (let l = 0; l < mustUpdate; ++l) {
    const customComparisonName = customComparisonsToUpdate[l]
    for (const article of articleList) {
      const articleCustomComparisonValue = article[customComparisonName]
      if (articleCustomComparisonValue === undefined || (typeof articleCustomComparisonValue === 'object' && articleCustomComparisonValue !== null)) {
        continue // typeof null returns 'object' even though it's not supposed to
      }
      if (!toUpdate[article._id]) {
        if (!article.customComparisons) {
          article.customComparisons = {}
        }
        article.customComparisons[customComparisonName] = articleCustomComparisonValue
        toUpdate[article._id] = article
      } else {
        toUpdate[article._id].customComparisons[customComparisonName] = articleCustomComparisonValue
      }
    }
  }

  // Update anything if necessary
  const updates = []
  for (const id in toUpdate) {
    const article = toUpdate[id]
    updates.push(dbCmds.update(feedCollection || Feed, article))
  }
  await Promise.all(updates)
  return { status: 'success', link, feedCollection, feedCollectionId }
}
