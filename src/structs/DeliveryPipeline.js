const DeliveryRecord = require('../models/DeliveryRecord.js')
const ArticleMessage = require('./ArticleMessage.js')
const Feed = require('./db/Feed.js')
const ArticleRateLimiter = require('./ArticleMessageRateLimiter.js')
const createLogger = require('../util/logger/create.js')
const configuration = require('../config.js')

class DeliveryPipeline {
  constructor (bot) {
    this.bot = bot
    this.log = createLogger(this.bot.shard.ids[0])
    const config = configuration.get()
    this.logFiltered = config.log.unfiltered === true
  }

  getChannel (newArticle) {
    const { feedObject } = newArticle
    return this.bot.channels.cache.get(feedObject.channel)
  }

  async createArticleMessage (newArticle, debug) {
    const { article, feedObject } = newArticle
    return ArticleMessage.create(feedObject, article, debug)
  }

  async deliver (newArticle, debug) {
    const channel = this.getChannel(newArticle)
    if (!channel) {
      return
    }
    try {
      const articleMessage = await this.createArticleMessage(newArticle, debug)
      if (!articleMessage.passedFilters()) {
        return await this.handleArticleBlocked(newArticle)
      }
      await this.sendNewArticle(newArticle, articleMessage)
    } catch (err) {
      await this.handleArticleFailure(newArticle, err)
    }
  }

  async handleArticleBlocked (newArticle) {
    const { article } = newArticle
    if (this.logFiltered) {
      this.log.info(`'${article.link || article.title}' did not pass filters and was not sent`)
    }
    await this.recordFilterBlock(newArticle)
  }

  async handleArticleFailure (newArticle, err) {
    const { article, feedObject } = newArticle
    const channel = this.getChannel(newArticle)
    await this.recordFailure(newArticle, err.message || 'N/A')
    if (err.message.includes('limited')) {
      this.log.debug({
        error: err
      }, 'Ignoring rate-limited article')
      return
    }
    this.log.warn({
      error: err
    }, `Failed to deliver article ${article._id} (${article.link}) of feed ${feedObject._id}`)
    if (err.code === 50035) {
      // Invalid format within an embed for example
      await channel.send(`Failed to send article <${article.link}>.\`\`\`${err.message}\`\`\``)
    }
  }

  async sendNewArticle (newArticle, articleMessage) {
    const { article, feedObject } = newArticle
    await ArticleRateLimiter.enqueue(articleMessage, this.bot)
    await this.recordSuccess(newArticle)
    this.log.debug(`Sent article ${article._id} of feed ${feedObject._id}`)
  }

  async recordFailure (newArticle, errorMessage) {
    if (!Feed.isMongoDatabase) {
      return
    }
    const { article, feedObject } = newArticle
    const channel = feedObject.channel
    const data = {
      articleID: article._id,
      feedURL: feedObject.url,
      channel,
      delivered: false,
      comment: errorMessage
    }
    this.log.debug({
      data
    }, 'Recording delivery record failure')
    try {
      const record = new DeliveryRecord.Model(data)
      await record.save()
    } catch (err) {
      this.log.error(err, `Failed to record article ${article._id} delivery failure in channel ${channel} (error: ${errorMessage})`)
    }
  }

  async recordSuccess (newArticle) {
    if (!Feed.isMongoDatabase) {
      return
    }
    const { article, feedObject } = newArticle
    const channel = feedObject.channel
    const data = {
      articleID: article._id,
      feedURL: feedObject.url,
      delivered: true,
      channel
    }
    this.log.debug({
      data
    }, 'Recording delivery record success')
    try {
      const record = new DeliveryRecord.Model(data)
      await record.save()
    } catch (err) {
      this.log.error(err, `Failed to record article ${article._id} delivery success in channel ${channel}`)
    }
  }

  async recordFilterBlock (newArticle) {
    if (!Feed.isMongoDatabase) {
      return
    }
    const { article, feedObject } = newArticle
    const channel = feedObject.channel
    const data = {
      articleID: article._id,
      feedURL: feedObject.url,
      channel,
      delivered: false,
      comment: 'Blocked by filters'
    }
    this.log.debug({
      data
    }, 'Recording delivery record filter block')
    try {
      const record = new DeliveryRecord.Model(data)
      await record.save()
    } catch (err) {
      this.log.error(err, `Failed to record article ${article._id} delivery blocked by filters in channel ${channel}`)
    }
  }
}

module.exports = DeliveryPipeline
