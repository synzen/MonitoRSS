const dbCmds = require('../db/commands.js')
const moment = require('moment-timezone')
const defaultConfigs = require('../../util/checkConfig.js').defaultConfigs
const log = require('../../util/logger.js')
const Article = require('../../models/Article.js')
const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')

/**
 * @param {object} article
 * @param {object} source
 * @param {string} rssName
 * @param {function} callbackFunc
 */
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

/**
 * @typedef {object} DatabaseData
 * @property {Set<string>} dbIds - Set of stored database IDs
 * @property {Set<string>} dbTitles - Set of stored database titles
 * @property {object<string, string[]>} dbCustomComparisons - Comparison names as keys, and their relevant article values in arrays
 */

/**
 * @param {import('mongoose').Model|object[]} collection
 * @returns {DatabaseData}
 */
async function getDataFromDocuments (collection) {
  const dbIds = new Set()
  const dbTitles = new Set()
  /** @type {object<string, string[]} */
  const dbCustomComparisons = {}
  const docs = await dbCmds.findAll(collection)
  for (const doc of docs) {
    // Push the main data for built in comparisons
    dbIds.add(doc.id)
    dbTitles.add(doc.title)

    // Now deal with custom comparisons
    const docCustomComparisons = doc.customComparisons
    if (docCustomComparisons !== undefined && Object.keys(docCustomComparisons).length > 0) {
      for (const articleProperty in docCustomComparisons) { // n = customComparison's name (such as description, author, etc.)
        const value = docCustomComparisons[articleProperty]
        if (!dbCustomComparisons[articleProperty]) {
          dbCustomComparisons[articleProperty] = [value]
        } else {
          dbCustomComparisons[articleProperty].push(value)
        }
      }
    }
  }

  return { dbIds, dbTitles, dbCustomComparisons }
}

/**
 * @param {object[]} collection
 * @param {Set<string>} dbIds
 * @param {string} useIdType
 * @param {object[]} articleList
 * @param {object<string, string[]>} dbCustomComparisons
 * @returns {Set<string>}
 */
async function articleListTasks (collection, dbIds, useIdType, articleList, dbCustomComparisons) {
  const toInsert = []
  const dbCustomComparisonsValid = new Set()
  const dbCustomComparisonsToDelete = new Set()

  const checkCustomComparisons = Object.keys(dbCustomComparisons).length > 0
  for (const article of articleList) {
    article._id = ArticleIDResolver.getIDTypeValue(article, useIdType)
    if (checkCustomComparisons) {
    // Iterate over the values stored in the db, and see if the custom comparison names in the db exist in any of the articles. If they do, then it is marked valid
      for (const compName in dbCustomComparisons) {
        if (article[compName] !== undefined && (typeof article[compName] !== 'object' || article[compName] === null)) {
          dbCustomComparisonsValid.add(compName)
        }
      }
    }
    if (!dbIds.has(article._id)) {
      toInsert.push(article)
    }
  }

  for (const articleProperty in dbCustomComparisons) {
    if (!dbCustomComparisonsValid.has(articleProperty)) {
      dbCustomComparisonsToDelete.add(articleProperty)
      delete dbCustomComparisons[articleProperty]
    }
  }

  await dbCmds.bulkInsert(collection, toInsert)

  return dbCustomComparisonsToDelete
}

/**
 * @param {object} config - The default config.json
 * @param {object} source - User's source config
 */
function determineArticleChecks (config, source) {
  const globalDateCheck = config.feeds.checkDates != null ? config.feeds.checkDates : defaultConfigs.feeds.checkDates.default
  const localDateCheck = source.checkDates
  const checkDate = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck

  const globalTitleCheck = config.feeds.checkTitles != null ? config.feeds.checkTitles : defaultConfigs.feeds.checkTitles.default
  const localTitleCheck = source.checkTitles
  const checkTitle = typeof globalTitleCheck !== 'boolean' ? globalTitleCheck : localTitleCheck

  return { checkDate, checkTitle }
}

module.exports = async (data, callbackArticle) => {
  const { rssList, articleList, debugFeeds, link, shardId, config, feedData, scheduleName, runNum, useIdType } = data // feedData is only defined when config.database.uri is set to a databaseless folder path
  if (!scheduleName) throw new Error('Missing schedule name for shared logic')
  const totalArticles = articleList.length
  const customComparisonsToUpdate = []
  const toUpdate = {} // Article's resolved IDs as key and the article as value
  const collectionID = Article.getCollectionID(link, shardId, scheduleName)
  const Feed = Article.modelByID(collectionID)
  const feedCollectionId = feedData ? collectionID : undefined
  const feedCollection = feedData ? (feedData[feedCollectionId] || []) : undefined

  const { dbIds, dbTitles, dbCustomComparisons } = await getDataFromDocuments(feedCollection || Feed)
  const dbCustomComparisonsToDelete = await articleListTasks(feedCollection || Feed, dbIds, useIdType, articleList, dbCustomComparisons)

  if (dbIds.size === 0) {
    // Tthe database collection has not been initialized. If a feed has 100 articles, skip everything past this point so it doesn't send 100 articles.
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
        if (!dbCustomComparisons[name] && !dbCustomComparisonsToDelete.has(name) && !customComparisonsToUpdate.includes(name)) {
          customComparisonsToUpdate.push(name) // Since this custom comparison wasn't found in the db, it might be uninitialized or not found in any articles (as checked previously)
        }
      }
    }

    if (toDebug) {
      log.debug.info(`${rssName}: Processing collection. Total article list length: ${totalArticles}`)
    }

    const maxAge = config.feeds.cycleMaxAge
    const cutoffDay = moment().subtract(maxAge, 'days')

    const { checkDate, checkTitle } = determineArticleChecks(config, source)

    if (toDebug) {
      log.debug.info('Database IDs:', JSON.stringify(Array.from(dbIds)))
      log.debug.info('Database Titles:', JSON.stringify(Array.from(dbTitles)))
    }
    for (let a = totalArticles - 1; a >= 0; --a) { // Loop from oldest to newest so the queue that sends articleMessages work properly, sending the older ones first
      const article = articleList[a]
      const matchedID = dbIds.has(article._id)
      const matchedTitle = checkTitle && (dbTitles.has(article.title) || sentTitles.has(article.title))
      const matchedDate = checkDate && ((!article.pubdate || article.pubdate.toString() === 'Invalid Date') || (article.pubdate && article.pubdate.toString() !== 'Invalid Date' && article.pubdate < cutoffDay))
      let seen = false
      if (matchedID || matchedTitle || matchedDate) {
        if (toDebug) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) Matched ${matchedID ? 'ID' : matchedTitle ? 'title' : matchedDate ? 'date' : 'UNKNOWN CASE'}.`)
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
