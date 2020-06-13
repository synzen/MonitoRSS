const DeliveryRecord = require('../models/DeliveryRecord.js')
const ArticleMessage = require('./ArticleMessage.js')
const Feed = require('./db/Feed.js')
const ArticleRateLimiter = require('./ArticleMessageRateLimiter.js')
const FeedData = require('./FeedData.js')
const createLogger = require('../util/logger/create.js')
const getConfig = require('../config.js').get

class DeliveryPipeline {
  constructor (bot) {
    this.bot = bot
    this.log = createLogger(this.bot.shard.ids[0])
    const config = getConfig()
    this.logFiltered = config.log.unfiltered === true
  }

  getChannel (newArticle) {
    const { feedObject } = newArticle
    return this.bot.channels.cache.get(feedObject.channel)
  }

  async createArticleMessage (newArticle, debug) {
    const { article, feedObject } = newArticle
    const constructedFeed = new Feed(feedObject)
    const feedData = await FeedData.ofFeed(constructedFeed)
    return new ArticleMessage(this.bot, article, feedData, debug)
  }

  async deliver (newArticle, debug) {
    const { article, feedObject } = newArticle
    const channel = this.getChannel(newArticle)
    try {
      if (!channel) {
        throw new Error(`Missing channel ${feedObject.channel}`)
      }
      const articleMessage = await this.createArticleMessage(newArticle, debug)
      if (!articleMessage.passedFilters()) {
        if (this.logFiltered) {
          this.log.info(`'${article.link || article.title}' did not pass filters and was not sent`)
        }
        return await this.recordFilterBlock(newArticle)
      }
      await ArticleRateLimiter.enqueue(articleMessage)
      await this.recordSuccess(newArticle)
      this.log.debug(`Sent article ${article._id} of feed ${feedObject._id}`)
    } catch (err) {
      await this.recordFailure(newArticle, err.message || 'N/A')
      if (err.message.includes('Rate limit')) {
        this.log.debug({
          error: err
        }, 'Ignoring rate-limited article')
        return
      }
      this.log.warn({
        error: err,
        guild: channel.guild,
        channel
      }, `Failed to deliver article ${article._id} (${article.link}) of feed ${feedObject._id}`)
      if (err.code === 50035) {
        // Invalid format within an embed for example
        channel.send(`Failed to send article <${article.link}>.\`\`\`${err.message}\`\`\``)
          .catch(err => this.log.warn({
            error: err
          }, 'Unable to send failed-to-send message for article'))
      }
    }
  }

  async recordFailure (newArticle, error) {
    const { article, feedObject } = newArticle
    const channel = feedObject.channel
    const data = {
      articleID: article._id,
      channel,
      delivered: false,
      comment: error
    }
    this.log.debug({
      data
    }, 'Recording delivery record failure')
    try {
      const record = new DeliveryRecord.Model()
      await record.save()
    } catch (err) {
      this.log.error(err, `Failed to record article ${article._id} delivery failure in channel ${channel} (error: ${error})`)
    }
  }

  async recordSuccess (newArticle) {
    const { article, feedObject } = newArticle
    const channel = feedObject.channel
    const data = {
      articleID: article._id,
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
    const { article, feedObject } = newArticle
    const channel = feedObject.channel
    const data = {
      articleID: article._id,
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
