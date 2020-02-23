const { EventEmitter } = require('events')

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
 * @property {Object} config - config.js values
 */

class LinkLogic extends EventEmitter {
  /**
   * @param {LinkData} data
   */
  constructor (data) {
    super()
    const { rssList, articleList, debugFeeds, link, config } = data // feedData is only defined when config.database.uri is set to a databaseless folder path
    this.rssList = rssList
    this.articleList = articleList
    this.link = link
    this.config = config

    /**
     * @type {Set<string>}
     */
    this.debug = new Set(debugFeeds || [])

    /**
     * dbReferences structure for each feed ID
     * @type {Map<string, Map<string, Set<string>>>}
     */
    this.sentReferences = new Map()

    const cutoffDay = new Date()
    cutoffDay.setDate(cutoffDay.getDate() - config.feeds.cycleMaxAge)
    this.cutoffDay = cutoffDay
  }

  /**
   * @param {Object[]} docs
   */
  static getComparisonReferences (docs) {
    /** @type {Map<string, Set<string>>} */
    const dbReferences = new Map()
    for (const doc of docs) {
      // Add the ID

      // Deal with article-specific properties
      const properties = doc.properties
      for (const property in properties) {
        /** @type {string[]} */
        const propertyValue = properties[property]

        // Create or add to the property sets
        if (!dbReferences.has(property)) {
          dbReferences.set(property, new Set([propertyValue]))
        } else {
          dbReferences.get(property).add(propertyValue)
        }
      }
    }
    return dbReferences
  }

  /**
   * @param {Object} article
   * @param {Object} feed
   * @returns {FormattedArticle}
   */
  static formatArticle (article, feed) {
    // For ArticleMessage to access once ScheduleManager receives this article
    return {
      ...article,
      _feed: feed
    }
  }

  /**
   * Negative comparisons block articles from passing if ID was not seen
   * @param {Object<string, any>[]} articleList
   * @param {string[]} comparisons
   * @param {Map<string, Set<string>>} dbReferences
   * @param {Map<string, Set<string>>} sentReferencesOfFeed - Specifically for a particular feed ID
   */
  static negativeComparisonBlocks (article, comparisons, dbReferences, sentReferencesOfFeed) {
    if (comparisons.length === 0) {
      return false
    }
    for (const property of comparisons) {
      const value = article[property]
      if (!value || typeof value !== 'string') {
        continue
      }
      const propertyValues = dbReferences.get(property)
      if (propertyValues && propertyValues.has(value)) {
        return true
      }
      const tempPropertyValues = sentReferencesOfFeed ? sentReferencesOfFeed.get(property) : null
      if (tempPropertyValues && tempPropertyValues.has(value)) {
        return true
      }
      // At this point, the property is not stored
    }
    return false
  }

  /**
   * Positive comparisons sends articles through if ID was seen
   * @param {Object<string, any>[]} articleList
   * @param {string[]} comparisons
   * @param {Map<string, Set<string>>} dbReferences
   * @param {Map<string, Set<string>>} sentReferencesOfFeed
   */
  static positiveComparisonPasses (article, comparisons, dbReferences, sentReferencesOfFeed) {
    if (comparisons.length === 0) {
      return false
    }
    for (const property of comparisons) {
      const value = article[property]
      if (!value || typeof value !== 'string') {
        continue
      }
      const propertyValues = dbReferences.get(property)
      if (!propertyValues) {
        /**
         * Property is uninitialized in database. Without
         * this check, all articles would send when a
         * pcomparison is added.
         */
        continue
      }
      if (propertyValues && propertyValues.has(value)) {
        continue
      }
      const tempPropertyValues = sentReferencesOfFeed ? sentReferencesOfFeed.get(property) : null
      if (tempPropertyValues && tempPropertyValues.has(value)) {
        continue
      }
      // At this point, the property is not stored
      return true
    }
    return false
  }

  /**
   * @param {Set<string>} dbIDs
   * @param {Object<string, any>} article
   * @param {boolean} checkDates
   * @param {Map<string, Set<string>>} comparisonReferences
   * @param {Object<string, any>} feed
   */
  isNewArticle (dbIDs, article, feed, checkDates, comparisonReferences, debug) {
    const { sentReferences, cutoffDay } = this
    const sentReferencesOfFeed = sentReferences.get(feed._id)
    const articleID = article._id
    const { ncomparisons, pcomparisons } = feed
    if (!articleID) {
      return false
    }
    if (!dbIDs.has(articleID)) {
      // Normally passes since ID is unseen, unless negative comparisons blocks
      const blocked = LinkLogic.negativeComparisonBlocks(article, ncomparisons, comparisonReferences, sentReferencesOfFeed)
      if (blocked) {
        return false
      }
    } else {
      // Normally blocked since the ID is seen, unless positive comparisons passes
      const passed = LinkLogic.positiveComparisonPasses(article, pcomparisons, comparisonReferences, sentReferencesOfFeed)
      if (!passed) {
        return false
      }
    }
    // At this point, the article should send.
    if (checkDates) {
      const block = !article.pubdate || article.pubdate.toString() === 'Invalid Date' || article.pubdate < cutoffDay
      if (block) {
        return false
      }
    }
    // Store the property value into buffers
    this.storePropertiesToBuffer(feed, article)
    return true
  }

  /**
   * @param {Object<string, any>} feed
   * @param {Object<string, any>} article
   */
  storePropertiesToBuffer (feed, article) {
    const { sentReferences } = this
    const feedID = feed._id
    const properties = [...feed.ncomparisons, ...feed.pcomparisons]
    for (const property of properties) {
      const value = article[property]
      if (!value || typeof value !== 'string') {
        continue
      }
      if (!sentReferences.has(feedID)) {
        sentReferences.set(feedID, new Map([[property, new Set([value])]]))
      } else if (!sentReferences.get(feedID).has(property)) {
        sentReferences.get(feedID).set(property, new Set([value]))
      } else {
        sentReferences.get(feedID).get(property).add(value)
      }
    }
  }

  static shouldCheckDates (config, feed) {
    const globalDateCheck = config.feeds.checkDates
    const localDateCheck = feed.checkDates
    const checkDates = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck
    return checkDates
  }

  /**
   * @param {Set<string>} dbIDs
   * @param {Object<string, any>} feed
   * @param {Object<string, any>[]} articleList
   * @param {Map<string, Set<string>>} comparisonReferences
   */
  getNewArticlesOfFeed (dbIDs, feed, articleList, comparisonReferences) {
    const { debug, config } = this
    const feedID = feed._id
    const totalArticles = articleList.length
    const checkDates = LinkLogic.shouldCheckDates(config, feed)
    const toDebug = debug.has(feedID)

    // if (toDebug) {
    //   log.debug.info(`${feedID}: Processing collection. Total article list length: ${totalArticles}.\nDatabase IDs:\n${JSON.stringify(Array.from(dbIDs), null, 2)}}`)
    // }

    const newArticles = []
    // Loop from oldest to newest so the queue that sends articleMessages work properly, sending the older ones first
    for (let a = totalArticles - 1; a >= 0; --a) {
      const article = articleList[a]
      const isNew = this.isNewArticle(dbIDs, article, feed, checkDates, comparisonReferences, toDebug)
      // const isNew = this.checkIfNewArticle(feedID, feed, article, toDebug)
      if (isNew) {
        newArticles.push(LinkLogic.formatArticle(article, feed))
      }
    }
    return newArticles
  }

  async run (docs) {
    const { link, rssList, articleList } = this
    const newArticles = []
    const dbIDs = new Set(docs.map(doc => doc.id))
    const comparisonReferences = await LinkLogic.getComparisonReferences(docs)
    for (const feedID in rssList) {
      const feed = rssList[feedID]
      // Database collection is uninitialized if no db IDs. Don't send any articles, just store.
      if (dbIDs.size === 0) {
        continue
      }
      const articlesToSend = this.getNewArticlesOfFeed(dbIDs, feed, articleList, comparisonReferences)
      articlesToSend.forEach(a => newArticles.push(a))
    }
    return {
      link,
      newArticles
    }
  }
}

module.exports = LinkLogic
