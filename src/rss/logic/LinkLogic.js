const moment = require('moment')
const Article = require('../../structs/Article.js')
const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')
const { defaultConfigs } = require('../../util/checkConfig.js')
const dbCmds = require('../db/commands.js')
const { EventEmitter } = require('events')
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
    this.debug = new Set(debugFeeds || [])

    // The 4 properties below are set during run()
    this.dbTitles = new Set()
    this.dbIds = new Set()
    this.dbCustomComparisons = {}
    this.customComparisonsToUpdate = new Set()
    this.dbCustomComparisonsToDelete = new Set()

    this.cutoffDay = moment().subtract(config.feeds.cycleMaxAge, 'days')
    this.toUpdate = {} // Article's resolved IDs as key and the article as value

    /**
     * @type {Object<string, SourceSettings>}
     */
    this.memoizedSourceSettings = {}
  }

  static get DEFAULT_CONFIGS () {
    return defaultConfigs
  }

  /**
   * @typedef {object} DatabaseData
   * @property {Set<string>} dbIds - Set of stored database IDs
   * @property {Set<string>} dbTitles - Set of stored database titles
   * @property {Object<string, string[]>} dbCustomComparisons - Comparison names as keys, and their relevant article values in arrays
   */

  /**
   * @param {import('mongoose').Model|Object[]} collection
   * @param {Object} dbCustomComparisons
   * @returns {DatabaseData}
   */
  async getDataFromDocuments (collection) {
    const { dbIds, dbTitles, dbCustomComparisons } = this

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

    return { dbIds, dbTitles }
  }

  /**
   * @param {Object[]} collection
   * @param {Set<string>} dbIds
   * @param {string} useIdType
   * @param {Object[]} articleList
   * @param {Object<string, string[]>} dbCustomComparisons
   * @param {Set<string>} dbCustomComparisonsToDelete
   * @returns {Set<string>}
   */
  async articleListTasks (collection) {
    const { dbIds, useIdType, articleList, dbCustomComparisons, dbCustomComparisonsToDelete } = this
    const toInsert = []
    const dbCustomComparisonsValid = new Set()

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
   * @param {string} rssName - Feed ID
   * @param {Object} source - Feed object
   */
  handleSource (rssName, source) {
    const { articleList, dbIds, dbTitles, dbCustomComparisons, dbCustomComparisonsToDelete, customComparisonsToUpdate } = this
    const totalArticles = this.articleList.length

    const toDebug = this.debug.has(rssName)
    const customComparisons = source.customComparisons // Array of names

    if (Array.isArray(customComparisons)) {
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

    if (toDebug) {
      log.debug.info(`${rssName}: Processing collection. Total article list length: ${totalArticles}`)
    }

    if (toDebug) {
      log.debug.info('Database IDs:', JSON.stringify(Array.from(dbIds)))
      log.debug.info('Database Titles:', JSON.stringify(Array.from(dbTitles)))
    }

    const sentTitles = new Set()
    for (let a = totalArticles - 1; a >= 0; --a) { // Loop from oldest to newest so the queue that sends articleMessages work properly, sending the older ones first
      this.handleArticle(rssName, source, articleList[a], sentTitles, toDebug)
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
  handleArticle (rssName, source, article, sentTitles, toDebug) {
    const { debugFeeds, config, dbIds, dbTitles, dbCustomComparisons, runNum, toUpdate, cutoffDay } = this
    const { customComparisons } = source
    const { checkDate, checkTitle } = this.determineArticleChecks(config, source)

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
      return
    }

    // Check for extra user-specified comparisons
    if (!seen) {
      this.emit(LinkLogic.formatArticle(article, source, rssName))
      return
    }
    if (!Array.isArray(customComparisons)) {
      return
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
        return // The comparison must either be uninitialized or invalid (no such comparison exists in any articles from the request), handled by a previous function. OR it exists in the db
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
      this.emit(LinkLogic.formatArticle(article, source, rssName))
    }
  }

  async run () {
    const { scheduleName, articleList, link, shardId, feedData, rssList, toUpdate, dbIds, customComparisonsToUpdate } = this
    if (!scheduleName) {
      throw new Error('Missing schedule name for shared logic')
    }
    const collectionID = Article.getCollectionID(link, shardId, scheduleName)
    const Feed = Article.modelByID(collectionID)
    const feedCollectionId = feedData ? collectionID : undefined
    const feedCollection = feedData ? (feedData[feedCollectionId] || []) : undefined

    await LinkLogic.getDataFromDocuments(feedCollection || Feed)
    await LinkLogic.articleListTasks(feedCollection || Feed)

    if (dbIds.size === 0) {
      // Tthe database collection has not been initialized. If a feed has 100 articles, skip everything past this point so it doesn't send a crazy number of articles.
      return { link, feedCollection, feedCollectionId }
    }

    for (const rssName in rssList) {
      this.handleSource(rssName, rssList[rssName])
    }

    customComparisonsToUpdate.forEach(customComparisonName => {
      for (const article of articleList) {
        const articleCustomComparisonValue = article[customComparisonName]
        if (articleCustomComparisonValue === undefined || (typeof articleCustomComparisonValue === 'object' && articleCustomComparisonValue !== null)) {
          continue // typeof null returns 'object'
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
    })

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
