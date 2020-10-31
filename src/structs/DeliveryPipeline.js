const DeliveryRecord = require('../models/DeliveryRecord.js')
const ArticleMessage = require('./ArticleMessage.js')
const Feed = require('./db/Feed.js')
const ArticleRateLimiter = require('./ArticleMessageRateLimiter.js')
const createLogger = require('../util/logger/create.js')
const configuration = require('../config.js')
const ArticleQueue = require('./ArticleQueue.js')
const { default: PQueue } = require('p-queue')
const { Webhook } = require('discord.js')

/**
 * Core delivery pipeline
 */
class DeliveryPipeline {
  constructor (bot) {
    this.bot = bot
    this.log = createLogger(this.bot.shard.ids[0])
    const config = configuration.get()
    this.logFiltered = config.log.unfiltered === true
    this.serviceURL = config.deliveryServiceURL
    this.serviceEnabled = !!this.serviceURL
    /**
     * Created if this.serviceEnabled is true in setup()
     * @type {import('zeromq').Push|null}
     */
    this.serviceSock = null
    /**
     * A queue that only processes one task at a time. This
     * is necessary for zeromq since only one async send call
     * be be executed at any one time through
     * this.serviceSock.send().
     */
    this.serviceQueue = new PQueue({
      concurrency: 1
    })
    /**
     * ArticleQueues mapped by channel ID. For delivering
     * articles within this client and not an external
     * service.
     *
     * @type {Map<string, ArticleQueue>}
     */
    this.queues = new Map()
  }

  /**
   * @param {import('discord.js').Client} bot
   */
  static async create (bot) {
    const pipeline = new DeliveryPipeline(bot)
    await pipeline.setup()
    return pipeline
  }

  /**
   * If the delivery service is enabled, connect the socket
   */
  async setup () {
    if (this.serviceEnabled) {
      this.serviceSock = new (require('zeromq')).Push()
      await this.serviceSock.connect(this.serviceURL)
      this.log.info(`Delivery service at ${this.serviceURL} connected `)
    }
  }

  /**
   * Convert the details of a new article to a buffer for
   * transporting it to the delivery service over a socket
   *
   * @param {Object<string, any>} newArticle
   * @param {import('./ArticleMessage.js')} articleMessage
   */
  async formatForService (newArticle, articleMessage) {
    const { article, feedObject } = newArticle
    // Assert that the medium (either a channel or webhook) still exists
    const medium = await articleMessage.getMedium(this.bot)
    if (!medium) {
      throw new Error('Missing medium to send article via service')
    }
    // Make the fetch
    const apiPayloads = articleMessage.createAPIPayloads(medium)
    const apiRoute = medium instanceof Webhook ? `/webhooks/${medium.id}/${medium.token}` : `/channels/${medium.id}/messages`
    const postActions = []
    /**
     * Auto-announce feature executed by the delivery service. It is currently disabled due to
     * extremely long rate limits.
     */
    // if (medium.type === 'news') {
    //   postActions.push({
    //     type: 'announce'
    //   })
    // }
    return apiPayloads.map(apiPayload => Buffer.from(JSON.stringify({
      token: configuration.get().bot.token,
      article: {
        _id: article._id
      },
      feed: {
        _id: feedObject._id,
        url: feedObject.url,
        channel: feedObject.channel
      },
      api: {
        url: `https://discord.com/api${apiRoute}`,
        body: apiPayload,
        method: 'POST'
      },
      postActions
    })))
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
      this.log.debug(`Preparing to send new article ${newArticle.article._id} of feed ${newArticle.feedObject._id} to service`)
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

  /**
   * @param {Object<string, any>} newArticle
   * @param {import('./ArticleMessage.js')} articleMessage
   */
  async sendNewArticle (newArticle, articleMessage) {
    const { article, feedObject } = newArticle
    await ArticleRateLimiter.assertWithinLimits(articleMessage, this.bot)
    if (this.serviceEnabled) {
      const payloads = await this.formatForService(newArticle, articleMessage)
      await Promise.all(payloads.map(buffer => this.serviceQueue.add(() => this.serviceSock.send(buffer))))
      this.log.debug(`Sent article ${article._id} of feed ${feedObject._id} to service`)
    } else {
      // The articleMessage is within all limits
      const channelID = feedObject.channel
      const queue = this.getQueueForChannel(channelID)
      queue.enqueue(newArticle, articleMessage)
      this.log.debug(`Enqueued article ${article._id} of feed ${feedObject._id} within client`)
    }
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

  /**
   * Returns the new article queue for a channel.
   * If none exists, it creates a new one automatically
   *
   * @param {string} channelID
   * @returns {import('./ArticleQueue')}
   */
  getQueueForChannel (channelID) {
    if (!this.queues.has(channelID)) {
      const newQueue = new ArticleQueue(this.bot)
      this.queues.set(channelID, newQueue)
      return newQueue
    } else {
      return this.queues.get(channelID)
    }
  }
}

module.exports = DeliveryPipeline
