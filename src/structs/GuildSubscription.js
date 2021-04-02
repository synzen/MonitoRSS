const configuration = require('../config')
const fetch = require('node-fetch')

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

  static getApiConfig () {
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
    const { url, accessToken } = this.getApiConfig()
    if (!url) {
      // The service is disabled/not configured
      return null
    }
    try {
      const res = await fetch(`${url}/guilds/${guildId}`, {
        headers: {
          Authorization: accessToken
        }
      })
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
    const { url, accessToken } = this.getApiConfig()
    if (!url) {
      // The service is disabled/not configured
      return []
    }
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: accessToken
        }
      })
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
