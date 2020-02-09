const { EventEmitter } = require('events')
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
 * @property {Object} _feed
 */

/**
 * @typedef {Object} LinkData
 * @property {Object<string, Object>} rssList - Aggregated feed objects by feed ID from all guilds who use the same feed URL
 * @property {FeedArticle[]} articleList - Feed articles
 * @property {string[]} debugFeeds - Array of feed IDs to show debug info for
 * @property {string} link - The feed URL
 * @property {number} shardID - The shard ID of the parent process, if the bot is sharded
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
    const { rssList, articleList, debugFeeds, link, shardID, config, feedData, scheduleName, runNum, useIdType } = data // feedData is only defined when config.database.uri is set to a databaseless folder path
    this.rssList = rssList
    this.articleList = articleList
    this.link = link
    this.shardID = shardID
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
     * @type {Object<string, SourceSettings>}
     */
    this.memoizedSourceSettings = {}

    const cutoffDay = new Date()
    cutoffDay.setDate(cutoffDay.getDate() - config.feeds.cycleMaxAge)
    this.cutoffDay = cutoffDay
  }

  /**
   * @param {Object[]} docs
   */
  async getDataFromDocuments (docs) {
    const { dbIDs, dbTitles } = this

    for (const doc of docs) {
      // Push the main data for built in comparisons
      dbIDs.add(doc.id)
      dbTitles.add(doc.title)
    }
  }

  async getUnseenArticles () {
    const { dbIDs, useIdType, articleList } = this
    const toInsert = []

    for (const article of articleList) {
      article._id = ArticleIDResolver.getIDTypeValue(article, useIdType)
      if (!dbIDs.has(article._id)) {
        toInsert.push(article)
      }
    }
    return toInsert
  }

  /**
   * @param {Object} article
   * @param {Object} source
   * @returns {FormattedArticle}
   */
  static formatArticle (article, source) {
    // For ArticleMessage to access once ScheduleManager receives this article
    return {
      ...article,
      _feed: source
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
      if (toDebug) log.debug.info(`${rssName}: Emitting article (ID: ${article._id}, TITLE: ${article.title}) for default checks.`)
      this.emit('article', LinkLogic.formatArticle(article, source))
      return
    }
  }

  async run () {
    const { scheduleName, link, shardID, feedData, rssList, dbIDs, articleList, dbTitles, debug } = this
    if (!scheduleName) {
      throw new Error('Missing schedule name for shared logic')
    }
    const memoryCollectionID = feedData ? shardID + scheduleName + link : undefined
    const memoryCollection = feedData ? (feedData[memoryCollectionID] || []) : undefined

    const docs = await dbCmds.findAll(memoryCollection, link, shardID, scheduleName)
    await this.getDataFromDocuments(docs)
    const toInsert = await this.getUnseenArticles()
    await dbCmds.bulkInsert(memoryCollection, toInsert, link, shardID, scheduleName)

    if (dbIDs.size === 0) {
      // Tthe database collection has not been initialized. If a feed has 100 articles, skip everything past this point so it doesn't send a crazy number of articles.
      return { link, memoryCollection, memoryCollectionID }
    }

    for (const rssName in rssList) {
      const source = rssList[rssName]
      const totalArticles = articleList.length
      const toDebug = debug.has(rssName)

      if (toDebug) {
        log.debug.info(`${rssName}: Processing collection. Total article list length: ${totalArticles}.\nDatabase IDs:\n${JSON.stringify(Array.from(dbIDs), null, 2)}\nDatabase Titles:\n${JSON.stringify(Array.from(dbTitles), null, 2)}`)
      }

      for (let a = totalArticles - 1; a >= 0; --a) { // Loop from oldest to newest so the queue that sends articleMessages work properly, sending the older ones first
        this.checkIfNewArticle(rssName, source, articleList[a], toDebug)
      }
    }

    return { link, memoryCollection, memoryCollectionID }
  }
}

module.exports = LinkLogic
