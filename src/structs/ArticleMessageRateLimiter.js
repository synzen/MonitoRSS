const GeneralStats = require('../models/GeneralStats.js')
const DeliveryRecord = require('../models/DeliveryRecord.js')
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
    this.increased = increased
    this.articlesLimit = increased ? articlesLimit * 5 : articlesLimit
    this.articlesRemaining = this.articlesLimit
    if (this.articlesLimit !== 0) {
      this.timer = setInterval(() => {
        this.articlesRemaining = this.articlesLimit
      }, 1000 * 60 * refreshRateMinutes)
    }
  }

  static async updateArticlesBlocked () {
    if (this.blocked === 0 || !Supporter.isMongoDatabase) {
      return
    }
    /**
     * @type {import('mongoose').Document}
     */
    const found = await GeneralStats.Model.findById(GeneralStats.TYPES.ARTICLES_BLOCKED)
    if (!found) {
      const stat = new GeneralStats.Model({
        _id: GeneralStats.TYPES.ARTICLES_BLOCKED,
        data: ArticleRateLimiter.blocked
      })
      await stat.save()
    } else {
      await found.updateOne({
        $inc: {
          data: ArticleRateLimiter.blocked
        }
      })
    }
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
   * @param {import('discord.js').Client} bot
   */
  static async assertWithinLimits (articleMessage, bot) {
    const channel = articleMessage.getChannel(bot)
    if (!channel) {
      throw new Error('Missing channel for ArticleMessageRateLimiter satisfiesLimits')
    }
    const channelID = channel.id
    const articleLimiter = ArticleRateLimiter.getLimiter(channelID)
    if (articleLimiter.isAtLimit()) {
      ++ArticleRateLimiter.blocked
      throw new Error('Rate limited article')
    }
    if (await articleLimiter.isAtDailyLimit()) {
      ++ArticleRateLimiter.blocked
      throw new Error('Daily limited article')
    }
    ++ArticleRateLimiter.sent
    --articleLimiter.articlesRemaining
  }

  isAtLimit () {
    if (this.articlesLimit === 0) {
      return false
    } else {
      return this.articlesRemaining === 0
    }
  }

  static getUTCStartOfToday () {
    const now = new Date()
    const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
    return new Date(nowUTC)
  }

  async isAtDailyLimit () {
    const config = configuration.get()
    const dailyLimit = config.feeds.articleDailyChannelLimit
    if (this.increased || !dailyLimit) {
      return false
    }
    const count = await DeliveryRecord.Model.where({
      channel: this.channelID,
      delivered: true,
      addedAt: {
        $gte: ArticleRateLimiter.getUTCStartOfToday()
      }
    }).countDocuments()
    return count >= dailyLimit
  }

  async send (articleMessage, bot) {
    --this.articlesRemaining
    const sent = await articleMessage.send(bot)
    return sent
  }
}

/**
 * @type {Map<string, ArticleRateLimiter>}
 */
ArticleRateLimiter.limiters = new Map()

ArticleRateLimiter.blocked = 0

if (process.env.NODE_ENV !== 'test') {
  ArticleRateLimiter.timer = setInterval(async () => {
    try {
      await ArticleRateLimiter.updateArticlesBlocked()
    } catch (err) {
      const log = createLogger()
      log.error(err, 'Failed to update article stats')
    }
  }, 10000)
}

module.exports = ArticleRateLimiter
