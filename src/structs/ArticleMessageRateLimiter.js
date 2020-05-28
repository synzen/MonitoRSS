const Supporter = require('./db/Supporter.js')
const configuration = require('../config.js')

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
      throw new Error('Rate limited article')
    }
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

module.exports = ArticleRateLimiter
