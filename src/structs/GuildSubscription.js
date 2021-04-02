const configuration = require('../config')

class GuildSubscription {
  constructor ({
    guildId,
    maxFeeds,
    refreshRate,
    expireAt
  }) {
    this.guildId = guildId
    this.maxFeeds = maxFeeds
    this.refreshRate = refreshRate
    this.expireAt = expireAt
  }

  static getApiUrl () {
    return configuration.get().apis.pledge
  }

  static mapApiResponse (response) {
    return {
      guildId: response.guild_id,
      maxFeeds: configuration.get().feeds.max + response.extra_feeds,
      refreshRate: response.refresh_rate / 60,
      expireAt: response.expire_at
    }
  }

  static async getSubscription (guildId) {
    const apiUrl = this.getApiUrl()
    if (!apiUrl) {
      // The service is disabled/not configured
      return null
    }
    try {
      const res = {
        status: 200,
        json: async () => ({
          guild_id: guildId,
          extra_feeds: 100,
          refresh_rate: 1111,
          expire_at: new Date('2029-09-09')
        })
      }
      if (res.status === 200) {
        const json = await res.json()
        return new GuildSubscription(this.mapApiResponse(json))
      }
      if (res.status === 404) {
        return null
      }
      throw new Error(`Bad status code ${res.status}`)
    } catch (err) {
      /**
       * Errors should not be propagated to maintain normal functions.
       */
      return null
    }
  }

  /**
   * @returns {Promise<GuildSubscription[]>}
   */
  static async getAllSubscriptions () {
    const apiUrl = this.getApiUrl()
    if (!apiUrl) {
      // The service is disabled/not configured
      return []
    }
    try {
      const res = {
        status: 200,
        json: async () => [
          {
            guild_id: '240535022820392961',
            extra_feeds: 100,
            refresh_rate: 1111,
            expire_at: new Date('2029-09-09')
          }
        ]
      }
      if (res.status === 200) {
        const data = await res.json()
        return data.map((sub) => new GuildSubscription(this.mapApiResponse(sub)))
      }
      throw new Error(`Bad status code ${res.status}`)
    } catch (err) {
      /**
       * Errors should not be propagated to maintain normal functions.
       */
      return []
    }
  }

  hasSlowRate () {
    return this.slowRate
  }
}

module.exports = GuildSubscription
