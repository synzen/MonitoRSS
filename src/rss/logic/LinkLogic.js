const moment = require('moment')
const { EventEmitter } = require('events')
const Article = require('../../structs/Article.js')
const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')
const { defaultConfigs } = require('../../util/checkConfig.js')
const dbCmds = require('../db/commands.js')
const log = require('../../util/logger.js')

/**
 * @typedef {Object} LinkData
 * @property {Object<string, Object>} rssList - Aggregated feed objects by feed ID from all guilds who use the same feed URL
 * @property {Object[]} articleList - Feed articles
 * @property {string[]} debugFeeds - Array of feed IDs to show debug info for
 * @property {string} link - The feed URL
 * @property {number} shardId - The shard ID of the parent process, if the bot is sharded
 * @property {Object} config - config.js values
 * @property {string} scheduleName - The calling process's schedule name
 * @property {number} runNum - Number of times this schedule has run so far
 * @property {string} useIdType - The ID type that should be used for article differentiation
 * @property {Object<string, Object[]>} [feedData] - Databaseless in-memory collection of all stored articles
 */

/**
 * @typedef {Object} SourceSettings
 * @property {boolean} checkTitle
 * @property {boolean} checkDate
 */

/**
 * @typedef {Object} FormattedArticle
 * @property {Object} source
 * @property {string} rssName
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
     * @type {Set<string, string>}
     */
    this.debug = new Set(debugFeeds || [])

    /**
     * @type {Set<string, string>}
     */
    this.dbTitles = new Set()

    /**
     * @type {Set<string, string>}
     */
    this.dbIDs = new Set()

    /**
     * @type {Object<string, Set<string>>}
     * */
    this.dbCustomComparisons = {}

    /**
     * @type {Set<string, string>}
     */
    this.customComparisonsToUpdate = new Set()

    /**
     * @type {Set<string, string>}
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

  static get DEFAULT_CONFIGS () {
    return defaultConfigs
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
        for (const articleProperty in docCustomComparisons) { // n = customComparison's name (such as description, author, etc.)
          const values = docCustomComparisons[articleProperty]
          if (!dbCustomComparisons[articleProperty]) {
            dbCustomComparisons[articleProperty] = new Set(values)
          } else {
            values.forEach(value => dbCustomComparisons[articleProperty].add(value))
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
    article._delivery = {
      guildId: source.guildId, // Originally set in source through FeedSchedule.js
      dateSettings: source.dateSettings, // Not the actual date, but settings concerning date format/language/timezone. Originally set in source through FeedSchedule.js
      rssName,
      channelId: source.channel,
      source
    }

    return article
  }

  /**
   * @param {Object} config - The default config.json
   * @param {Object} source - User's source config
   * @param {string} rssName - Feed ID
   * @returns {SourceSettings}
   */
  determineArticleChecks (config, source, rssName) {
    const memoized = this.memoizedSourceSettings[rssName]
    if (memoized) {
      return this.memoizedSourceSettings[rssName]
    }

    const globalDateCheck = config.feeds.checkDates != null ? config.feeds.checkDates : LinkLogic.DEFAULT_CONFIGS.feeds.checkDates.default
    const localDateCheck = source.checkDates
    const checkDate = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck

    const globalTitleCheck = config.feeds.checkTitles != null ? config.feeds.checkTitles : LinkLogic.DEFAULT_CONFIGS.feeds.checkTitles.default
    const localTitleCheck = source.checkTitles
    const checkTitle = typeof globalTitleCheck !== 'boolean' ? globalTitleCheck : localTitleCheck

    if (!memoized) {
      this.memoizedSourceSettings[rssName] = { checkDate, checkTitle }
    }

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
   * @param {Object} article
   * @param {Set<string>} sentTitles - Previous titles stored in case of title checks
   * @param {boolean} toDebug - Whether to log progress
   * @fires LinkLogic#article
   */
  checkIfNewArticle (rssName, source, article, sentTitles, toDebug) {
    const { config, dbIDs, dbTitles, runNum, cutoffDay } = this
    const { checkDate, checkTitle } = this.determineArticleChecks(config, source)

    const matchedID = dbIDs.has(article._id)
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
      if (toDebug) {
        log.debug.warning(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}), config.feeds.sendOldOnFirstCycle is false`)
      }
      return
    }

    // Check for extra user-specified comparisons
    if (!seen) {
      this.emit(LinkLogic.formatArticle(article, source, rssName))
      return
    }

    this.checkIfNewArticleByCC(rssName, source, article, toDebug)
  }

  /**
   * @param {string} rssName
   * @param {Object} source
   * @param {Object} article
   * @param {boolean} toDebug - Whether to log progress
   */
  checkIfNewArticleByCC (rssName, source, article, toDebug) {
    const { dbCustomComparisons, toUpdate, customComparisonsToUpdate, dbCustomComparisonsToDelete } = this
    const { customComparisons } = source
    if (!Array.isArray(customComparisons)) {
      return
    }
    for (const comparisonName of customComparisons) {
      const dbCustomComparisonValues = dbCustomComparisons[comparisonName] // Might be an array of descriptions, authors, etc.
      const articleCustomComparisonValue = article[comparisonName]

      const pendingComparisonUpdate = customComparisonsToUpdate.has(comparisonName)
      const noComparisonsAvailable = !dbCustomComparisonValues
      const articleValueFound = dbCustomComparisonValues && dbCustomComparisonValues.has(articleCustomComparisonValue)
      const articleValueInvalid = dbCustomComparisonsToDelete.has(comparisonName)

      // Prepare it for update in the database
      if (pendingComparisonUpdate) {
        if (!article.customComparisons) {
          article.customComparisons = {}
        }
        article.customComparisons[comparisonName] = articleCustomComparisonValue
        toUpdate[article._id] = article
      } else if (articleValueInvalid) {
        delete article.customComparisons[comparisonName]
        toUpdate[article._id] = article
      }

      if (noComparisonsAvailable || articleValueFound || articleValueInvalid) {
        if (toDebug) {
          log.debug.info(`${rssName}: Not sending article (ID: ${article._id}, TITLE: ${article.title}) due to custom comparison check for ${comparisonName}. noComparisonsAvailable: ${noComparisonsAvailable}, pendingComparisonUpdate: ${pendingComparisonUpdate}, articleValueFound: ${articleValueFound}, articleValueInvalid: ${articleValueInvalid}.\ndbCustomComparisonValues:\n${dbCustomComparisonValues ? JSON.stringify(dbCustomComparisonValues, null, 2) : undefined}`)
        }
        return
      }

      if (toDebug) {
        log.debug.info(`${rssName}: Sending article (ID: ${article._id}, TITLE: ${article.title}) due to custom comparison check for ${comparisonName}`)
      }
      this.emit(LinkLogic.formatArticle(article, source, rssName))
    }
  }

  async run () {
    const { scheduleName, link, shardId, feedData, rssList, toUpdate, dbIDs } = this
    if (!scheduleName) {
      throw new Error('Missing schedule name for shared logic')
    }
    const collectionID = Article.getCollectionID(link, shardId, scheduleName)
    const Feed = Article.modelByID(collectionID)
    const feedCollectionId = feedData ? collectionID : undefined
    const feedCollection = feedData ? (feedData[feedCollectionId] || []) : undefined

    await LinkLogic.getDataFromDocuments(feedCollection || Feed)
    await LinkLogic.articleListTasks(feedCollection || Feed)

    if (dbIDs.size === 0) {
      // Tthe database collection has not been initialized. If a feed has 100 articles, skip everything past this point so it doesn't send a crazy number of articles.
      return { link, feedCollection, feedCollectionId }
    }

    for (const rssName in rssList) {
      const source = rssList[rssName]
      const { articleList, dbIDs, dbTitles } = this
      const totalArticles = this.articleList.length
      const toDebug = this.debug.has(rssName)

      this.validateCustomComparisons(source)

      if (toDebug) {
        log.debug.info(`${rssName}: Processing collection. Total article list length: ${totalArticles}.\nDatabase IDs:\n${JSON.stringify(Array.from(dbIDs), null, 2)}\nDatabase Titles:\n${JSON.stringify(Array.from(dbTitles), null, 2)}`)
      }

      const sentTitles = new Set()
      for (let a = totalArticles - 1; a >= 0; --a) { // Loop from oldest to newest so the queue that sends articleMessages work properly, sending the older ones first
        this.checkIfNewArticle(rssName, source, articleList[a], sentTitles, toDebug)
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
