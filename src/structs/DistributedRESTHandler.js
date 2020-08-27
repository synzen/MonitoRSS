const { Rest, RedisMutex, TokenType } = require('@spectacles/rest')
const Redis = require('ioredis')
const configuration = require('../config.js')
const createLogger = require('../util/logger/create.js')

class DistributedRESTHandler {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor (client) {
    this.botToken = client.token
    this.log = createLogger(client.shard.ids[0])

    this.redis = this.connectToRedis()
    this.enabled = false
    if (this.redis) {
      const options = {
        tokenType: TokenType.BOT,
        mutex: new RedisMutex(this.redis, 'mrss_articles_')
      }
      this.restClient = new Rest(this.botToken, options)
      this.enabled = true
    }
  }

  connectToRedis () {
    const redisUri = configuration.get().database.redis
    if (!redisUri) {
      return null
    }
    const redis = new Redis(redisUri)
    redis.on('error', (err) => {
      // this.log.error(err, 'Redis connection error')
      throw err
    })
    redis.on('connect', () => {
      this.log.info('Redis connected')
    })
    return redis
  }

  disconnectRedis () {
    this.redis.disconnect()
  }

  async sendChannelMessage (channelID, body) {
    console.log('send channel message')
    return this.restClient.post(`/channels/${channelID}/messages`, body)
  }

  /**
   * @param {import('discord.js').Webhook} webhook
   */
  async sendWebhookMessage (webhook, body) {
    console.log('send webhook')
    return this.restClient.post(`/webhooks/${webhook.id}/${webhook.token}`, body)
  }
}

module.exports = DistributedRESTHandler
