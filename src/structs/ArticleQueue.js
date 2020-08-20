const Feed = require('./db/Feed')
const DeliveryRecord = require('../models/DeliveryRecord.js')
const createLogger = require('../util/logger/create')
const configuration = require('../config.js')
const Supporter = require('./db/Supporter')
const GeneralStats = require('../models/GeneralStats.js')

/**
 * Staggers the delivery of new articles
 */
class ArticleQueue {
  constructor (client) {
    /**
     * @typedef {Object} ArticleDetails
     * @property {Object<string, any>} newArticle
     * @property {import('./ArticleMessage')} articleMessage
     */

    /**
     * @type {ArticleDetails[]}
     */
    this.queue = []
    /**
     * @type {import('discord.js').Client}
     */
    this.client = client
    this.log = createLogger(this.client.shard.ids[0])
    const config = configuration.get()
    const dequeueRate = config.feeds.articleDequeueRate
    const dequeueAmount = dequeueRate <= 1 ? 1 : dequeueRate
    const intervalSeconds = dequeueRate <= 1 ? 1 / dequeueRate : 1
    setInterval(() => {
      this.dequeue(dequeueAmount)
    }, 1000 * intervalSeconds)
  }

  /**
   * Dequeue a certain amount of articles from the queue
   * and send them in order
   *
   * @param {number} dequeueAmount
   */
  async dequeue (dequeueAmount) {
    // async must be used within the loop to main the order
    // in which articles are sent
    for (let i = 0; i < dequeueAmount; ++i) {
      if (this.queue.length === 0) {
        continue
      }
      const articleData = this.queue.shift()
      try {
        await articleData.articleMessage.send(this.client)
        await this.recordSuccess(articleData.newArticle)
      } catch (err) {
        await this.recordFailure(articleData.newArticle, err.message)
      }
    }
  }

  /**
   * Enqueue an article to be dequeued and sent at
   * the rate set in config
   *
   * @param {Object<string, any>} newArticle
   * @param {import('./ArticleMessage')} articleMessage
   */
  enqueue (newArticle, articleMessage) {
    this.queue.push({
      newArticle,
      articleMessage
    })
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
      this.log.error(err, `Failed to record article ${article._id} delivery failure in channel ${channel} (error: ${errorMessage}) in ArticleQueue`)
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
      this.log.error(err, `Failed to record article ${article._id} delivery success in channel ${channel} in ArticleQueue`)
    }
  }

  static async updateArticlesSent () {
    if (this.sent === 0 || !Supporter.isMongoDatabase) {
      return
    }
    /**
     * @type {import('mongoose').Document}
     */
    const found = await GeneralStats.Model.findById(GeneralStats.TYPES.ARTICLES_SENT)
    if (!found) {
      const stat = new GeneralStats.Model({
        _id: GeneralStats.TYPES.ARTICLES_SENT,
        data: ArticleQueue.sent
      })
      await stat.save()
    } else {
      await found.updateOne({
        $inc: {
          data: ArticleQueue.sent
        }
      })
    }
    this.sent = 0
  }
}

ArticleQueue.sent = 0

if (process.env.NODE_ENV !== 'test') {
  ArticleQueue.timer = setInterval(async () => {
    try {
      await ArticleQueue.updateArticlesSent()
    } catch (err) {
      const log = createLogger()
      log.error(err, 'Failed to update article stats')
    }
  }, 10000)
}

module.exports = ArticleQueue
