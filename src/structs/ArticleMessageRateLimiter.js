const GeneralStats = require('../models/GeneralStats.js')
const Supporter = require('./db/Supporter.js')
const configuration = require('../config.js')
const createLogger = require('../util/logger/create.js')

class ArticleRateLimiter {
  /**
   * @param {string} channelID
   * @param {boolean} increased
   */
  constructor (channelID, increased) {
    const config = configuration.get()
    const refreshRateMinutes = config.feeds.refreshRateMinutes
    const articlesLimit = config.feeds.articleRateLimit
    this.channelID = channelID
    this.articlesLimit = increased ? articlesLimit * 5 : articlesLimit
    this.articlesRemaining = this.articlesLimit
    if (this.articlesLimit !== 0) {
      this.timer = setInterval(() => {
        this.articlesRemaining = this.articlesLimit
      }, 1000 * 60 * refreshRateMinutes)
    }
  }

  static async updateArticlesSent () {
    if (this.sent === 0) {
      return
    }
    await GeneralStats.Model.updateOne({
      _id: GeneralStats.TYPES.ARTICLES_SENT
    }, {
      $inc: {
        data: ArticleRateLimiter.sent
      }
    }, {
      upsert: true
    })
    this.sent = 0
  }

  static async updateArticlesBlocked () {
    if (this.blocked === 0) {
      return
    }
    await GeneralStats.Model.updateOne({
      _id: GeneralStats.TYPES.ARTICLES_BLOCKED
    }, {
      $inc: {
        data: ArticleRateLimiter.blocked
      }
    }, {
      upsert: true
    })
    this.blocked = 0
  }

  /**
   * @param {string} channelID
   * @param {boolean} isSupporterGuild
   */
  static create (channelID, isSupporterGuild) {
    const highLimit = Supporter.enabled ? isSupporterGuild : true
    const limiter = new ArticleRateLimiter(channelID, highLimit)
    this.limiters.set(channelID, limiter)
    return limiter
  }

  static hasLimiter (channelID) {
    return this.limiters.has(channelID)
  }

  static getLimiter (channelID) {
    if (!this.hasLimiter(channelID)) {
      return this.create(channelID)
    } else {
      return this.limiters.get(channelID)
    }
  }

  /**
   * @param {import('../structs/ArticleMessage.js')} articleMessage
   */
  static async enqueue (articleMessage) {
    const channel = articleMessage.getChannel()
    if (!channel) {
      return
    }
    const channelID = channel.id
    const articleLimiter = ArticleRateLimiter.getLimiter(channelID)
    if (articleLimiter.isAtLimit()) {
      ++ArticleRateLimiter.blocked
      throw new Error('Rate limited article')
    }
    ++ArticleRateLimiter.sent
    await articleLimiter.send(articleMessage)
  }

  isAtLimit () {
    if (this.articlesLimit === 0) {
      return false
    } else {
      return this.articlesRemaining === 0
    }
  }

  /**
   * @param {import('./ArticleMessage.js')} articleMessage
   */
  async send (articleMessage) {
    --this.articlesRemaining
    const sent = await articleMessage.send()
    return sent
  }
}

/**
 * @type {Map<string, ArticleRateLimiter>}
 */
ArticleRateLimiter.limiters = new Map()

ArticleRateLimiter.sent = 0
ArticleRateLimiter.blocked = 0

if (process.env.NODE_ENV !== 'test') {
  ArticleRateLimiter.timer = setInterval(async () => {
    try {
      await ArticleRateLimiter.updateArticlesSent()
      await ArticleRateLimiter.updateArticlesBlocked()
    } catch (err) {
      const log = createLogger()
      log.error(err, 'Failed to update article stats')
    }
  }, 10000)
}

module.exports = ArticleRateLimiter
