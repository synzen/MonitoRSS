const moment = require('moment')
const { EventEmitter } = require('events')
const ArticleModel = require('../../models/Article.js')
const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')
const dbCmds = require('../db/commands.js')
const log = require('../../util/logger.js')

/**
 * @typedef {Object} FeedArticle
 */

/**
 * @typedef {Object} SourceSettings
 * @property {boolean} checkTitles
 * @property {boolean} checkDates
 */

/**
 * @typedef {Object} FormattedArticle
 * @property {Object} source
 * @property {string} rssName
 */

/**
 * @typedef {Object} LinkData
 * @property {Object<string, Object>} rssList - Aggregated feed objects by feed ID from all guilds who use the same feed URL
 * @property {FeedArticle[]} articleList - Feed articles
 * @property {string[]} debugFeeds - Array of feed IDs to show debug info for
 * @property {string} link - The feed URL
 * @property {number} shardId - The shard ID of the parent process, if the bot is sharded
 * @property {Object} config - config.js values
 * @property {string} scheduleName - The calling process's schedule name
 * @property {number} runNum - Number of times this schedule has run so far
 * @property {string} useIdType - The ID type that should be used for article differentiation
 * @property {Object<string, Object[]>} [feedData] - Databaseless in-memory collection of all stored articles
 */

class LinkLogic extends EventEmitter {
  /**
   * @param {LinkData} data
   */
  constructor (data) {
    super()
    const { rssList, articleList, debugFeeds, link, shardId, config, feedData, scheduleName, runNum, useIdType } = data // feedData is only defined when config.database.uri is set to a databaseless folder path
    this.rssList = rssList
    this.articleList = articleList
    this.link = link
    this.shardId = shardId
    this.config = config
    this.feedData = feedData
    this.scheduleName = scheduleName
    this.runNum = runNum
    this.useIdType = useIdType

    /**
     * @type {Set<string>}
     */
    this.debug = new Set(debugFeeds || [])

    /**
     * @type {Set<string>}
     */
    this.dbTitles = new Set()

    /**
     * @type {Object<string, Set<string>>}
     */
    this.sentTitlesByFeedID = {}

    /**
     * @type {Set<string>}
     */
    this.dbIDs = new Set()

    /**
     * @type {Object<string, Set<string>>}
     * */
    this.dbCustomComparisons = {}

    /**
     * @type {Set<string>}
     */
    this.customComparisonsToUpdate = new Set()

    /**
     * @type {Set<string>}
     */
    this.dbCustomComparisonsToDelete = new Set()

    /**
     * @type {Object<string, Object>}
     */
    this.toUpdate = {} // Article's resolved IDs as key and the article as value

    /**
     * @type {Object<string, SourceSettings>}
     */
    this.memoizedSourceSettings = {}

    this.cutoffDay = moment().subtract(config.feeds.cycleMaxAge, 'days')
  }

  /**
   * @param {import('mongoose').Model|Object[]} collection
   * @param {Object} dbCustomComparisons
   */
  async getDataFromDocuments (collection) {
    const { dbIDs, dbTitles, dbCustomComparisons } = this

    const docs = await dbCmds.findAll(collection)
    for (const doc of docs) {
      // Push the main data for built in comparisons
      dbIDs.add(doc.id)
      dbTitles.add(doc.title)

      // Now deal with custom comparisons
      const docCustomComparisons = doc.customComparisons
      if (docCustomComparisons !== undefined && Object.keys(docCustomComparisons).length > 0) {
        for (const articleProperty in docCustomComparisons) { // articleProperty = customComparison's name (such as description, author, etc.)
          const articleValue = docCustomComparisons[articleProperty]
          if (!dbCustomComparisons[articleProperty]) {
            dbCustomComparisons[articleProperty] = new Set([articleValue])
          } else {
            dbCustomComparisons[articleProperty].add(articleValue)
          }
        }
      }
    }
  }

  /**
   * @param {Object[]} collection
   * @param {Set<string>} dbIDs
   * @param {string} useIdType
   * @param {Object[]} articleList
   * @param {Object<string, Set<string>>} dbCustomComparisons
   * @param {Set<string>} dbCustomComparisonsToDelete
   */
  async articleListTasks (collection) {
    const { dbIDs, useIdType, articleList, dbCustomComparisons, dbCustomComparisonsToDelete } = this
    const toInsert = []

    const checkCustomComparisons = Object.keys(dbCustomComparisons).length > 0
    for (const article of articleList) {
      article._id = ArticleIDResolver.getIDTypeValue(article, useIdType)
      if (!dbIDs.has(article._id)) {
        toInsert.push(article)
      }
      if (!checkCustomComparisons) {
        continue
      }
      // Iterate over the values stored in the db, and see if the custom comparison names in the db exist in any of the articles. If they do, then it is marked valid
      for (const compName in dbCustomComparisons) {
        const validValue = article[compName] !== undefined && (typeof article[compName] !== 'object' && article[compName] !== null)
        if (!validValue) {
          dbCustomComparisonsToDelete.add(compName)
        }
      }
    }
    await dbCmds.bulkInsert(collection, toInsert)
  }

  /**
   * @param {Object} article
   * @param {Object} source
   * @param {string} rssName
   * @returns {FormattedArticle}
   */
  static formatArticle (article, source, rssName) {
    // For ArticleMessage to access once ScheduleManager receives this article

    return {
      ...article,
      _delivery: {
        rssName,
        source
      }
    }
  }

  /**
   * @param {Object} source - User's source config
   * @param {string} rssName - Feed ID
   * @returns {SourceSettings}
   */
  determineArticleChecks (source, rssName) {
    const { config } = this
    const memoized = this.memoizedSourceSettings[rssName]
    if (memoized) {
      return this.memoizedSourceSettings[rssName]
    }

    const globalDateCheck = config.feeds.checkDates
    const localDateCheck = source.checkDates
    const checkDates = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck

    const globalTitleCheck = config.feeds.checkTitles
    const localTitleCheck = source.checkTitles
    const checkTitles = typeof localTitleCheck !== 'boolean' ? globalTitleCheck : localTitleCheck

    this.memoizedSourceSettings[rssName] = { checkDates, checkTitles }

    return this.memoizedSourceSettings[rssName]
  }

  /**
   * @param {Object} source - Feed object
   */
  validateCustomComparisons (source) {
    const { dbCustomComparisons, dbCustomComparisonsToDelete, customComparisonsToUpdate } = this
    const { customComparisons } = source // Array of names
    if (!Array.isArray(customComparisons)) {
      return
    }
    for (let n = customComparisons.length - 1; n >= 0; --n) {
      const name = customComparisons[n]
      if (name === 'title' || name === 'guid' || name === 'pubdate') { // Forbidden custom comparisons since these are already used by the bot
        customComparisons.splice(n, 1)
        continue
      }
      if (!dbCustomComparisons[name] && !dbCustomComparisonsToDelete.has(name) && !customComparisonsToUpdate.has(name)) {
        customComparisonsToUpdate.add(name) // Since this custom comparison wasn't found in the db, it might be uninitialized or not found in any articles (as checked previously)
      }
    }
  }

  /**
   * @event LinkLogic#article
   * @type {FormattedArticle}
   */

  /**
   * @param {string} rssName
   * @param {Object} source
   * @param {FeedArticle} article
   * @param {boolean} toDebug - Whether to log progress
   * @fires LinkLogic#article
   */
  checkIfNewArticle (rssName, source, article, toDebug) {
    const { config, dbIDs, dbTitles, runNum, cutoffDay, sentTitlesByFeedID } = this
    const { checkDates, checkTitles } = this.determineArticleChecks(source, rssName)

    const matchedID = dbIDs.has(article._id)
    const matchedTitle = checkTitles && (dbTitles.has(article.title) || (sentTitlesByFeedID[rssName] && sentTitlesByFeedID[rssName].has(article.title)))
    const matchedDate = checkDates && (!article.pubdate || article.pubdate.toString() === 'Invalid Date' || article.pubdate < cutoffDay)
    let seen = false
    if (matchedID || matchedTitle || matchedDate) {
      if (toDebug) log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) Matched ${matchedID ? 'ID' : matchedTitle ? 'title' : matchedDate ? 'date' : 'UNKNOWN CASE'}.`)
      seen = true
    } else if (checkTitles) {
      if (article.title) {
        if (!sentTitlesByFeedID[rssName]) {
          sentTitlesByFeedID[rssName] = new Set()
        }
        sentTitlesByFeedID[rssName].add(article.title)
      } else {
        seen = true // Don't send an article with no title if title checks are on
      }
    }

    if (runNum === 0 && config.feeds.sendOldOnFirstCycle === false) {
      if (toDebug) {
        log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), config.feeds.sendOldOnFirstCycle is false`)
      }
      return
    }

    if (!seen) {
      this.emit('article', LinkLogic.formatArticle(article, source, rssName))
      return
    }

    this.checkIfNewArticleByCC(rssName, source, article, toDebug)
  }

  /**
   * @param {string} rssName
   * @param {Object} source
   * @param {FeedArticle} article
   * @param {boolean} toDebug - Whether to log progress
   */
  checkIfNewArticleByCC (rssName, source, article, toDebug) {
    const { dbCustomComparisons, dbCustomComparisonsToDelete } = this
    const { customComparisons } = source
    if (!Array.isArray(customComparisons)) {
      return
    }
    for (const comparisonName of customComparisons) {
      const dbCustomComparisonValues = dbCustomComparisons[comparisonName] // Might be an set of description, author or etc. values
      const articleCustomComparisonValue = article[comparisonName]

      const noComparisonsAvailable = !dbCustomComparisonValues
      const articleValueStored = dbCustomComparisonValues && dbCustomComparisonValues.has(articleCustomComparisonValue)
      const comparisonToBeDeleted = dbCustomComparisonsToDelete.has(comparisonName)

      this.updateArticleCCValues(article, comparisonName)

      if (noComparisonsAvailable || articleValueStored || comparisonToBeDeleted) {
        if (toDebug) {
          log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) due to custom comparison check for ${comparisonName}. noComparisonsAvailable: ${noComparisonsAvailable}, articleValueStored: ${articleValueStored}, comparisonToBeDeleted: ${comparisonToBeDeleted}.\ndbCustomComparisonValues:\n${dbCustomComparisonValues ? JSON.stringify(dbCustomComparisonValues, null, 2) : undefined}`)
        }
        return
      }

      if (toDebug) {
        log.debug.info(`${rssName}: Sending article (ID: ${article._id}, TITLE: ${article.title}) due to custom comparison check for ${comparisonName}`)
      }
      this.emit('article', LinkLogic.formatArticle(article, source, rssName))
    }
  }

  /**
   * @param {FeedArticle} article
   * @param {string} comparisonName
   */
  updateArticleCCValues (article, comparisonName) {
    const { toUpdate, customComparisonsToUpdate } = this
    // Prepare it for update in the database
    if (customComparisonsToUpdate.has(comparisonName)) {
      if (!article.customComparisons) {
        article.customComparisons = {}
      }
      article.customComparisons[comparisonName] = article[comparisonName]
      toUpdate[article._id] = article
    }
  }

  async run () {
    const { scheduleName, link, shardId, feedData, rssList, toUpdate, dbIDs, articleList, dbTitles, debug } = this
    if (!scheduleName) {
      throw new Error('Missing schedule name for shared logic')
    }
    const collectionID = ArticleModel.getCollectionID(link, shardId, scheduleName)
    const Feed = ArticleModel.modelByID(collectionID)
    const feedCollectionId = feedData ? collectionID : undefined
    const feedCollection = feedData ? (feedData[feedCollectionId] || []) : undefined

    await this.getDataFromDocuments(feedCollection || Feed)
    await this.articleListTasks(feedCollection || Feed)

    if (dbIDs.size === 0) {
      // Tthe database collection has not been initialized. If a feed has 100 articles, skip everything past this point so it doesn't send a crazy number of articles.
      return { link, feedCollection, feedCollectionId }
    }

    for (const rssName in rssList) {
      const source = rssList[rssName]
      const totalArticles = articleList.length
      const toDebug = debug.has(rssName)

      this.validateCustomComparisons(source)

      if (toDebug) {
        log.debug.info(`${rssName}: Processing collection. Total article list length: ${totalArticles}.\nDatabase IDs:\n${JSON.stringify(Array.from(dbIDs), null, 2)}\nDatabase Titles:\n${JSON.stringify(Array.from(dbTitles), null, 2)}`)
      }

      for (let a = totalArticles - 1; a >= 0; --a) { // Loop from oldest to newest so the queue that sends articleMessages work properly, sending the older ones first
        this.checkIfNewArticle(rssName, source, articleList[a], toDebug)
      }
    }

    // Update anything if necessary
    const updates = []
    for (const id in toUpdate) {
      const article = toUpdate[id]
      updates.push(dbCmds.update(feedCollection || Feed, article))
    }
    await Promise.all(updates)
    return { link, feedCollection, feedCollectionId }
  }
}

module.exports = LinkLogic
