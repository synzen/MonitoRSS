const configuration = require('../config')
const GuildSubscription = require('./GuildSubscription.js')
const Supporter = require('./db/Supporter.js')

class Guild {
  constructor (guildId) {
    this.id = guildId
  }

  /**
   * @returns {Promise<Map<string, number>>}
   */
  static async getAllUniqueFeedLimits () {
    if (!Supporter.enabled) {
      return new Map()
    }
    const supporterLimits = new Map()
    const supporters = await Supporter.getValidSupporters()
    for (const supporter of supporters) {
      const maxFeeds = await supporter.getMaxFeeds()
      const guilds = supporter.guilds
      for (const guildId of guilds) {
        supporterLimits.set(guildId, maxFeeds)
      }
    }
    const allSubs = await GuildSubscription.getAllSubscriptions()
    allSubs.forEach(({ guildId, maxFeeds }) => {
      supporterLimits.set(guildId, maxFeeds)
    })
    return supporterLimits
  }

  async getSupporter () {
    if (!Supporter.enabled) {
      return null
    }
    return Supporter.getValidSupporterOfGuild(this.id)
  }

  async getSubscription () {
    if (!Supporter.enabled) {
      return null
    }
    return GuildSubscription.getSubscription(this.id)
  }

  async getMaxFeeds () {
    const config = configuration.get()
    const data = await this.getSubscription(this.id)
    let maxFeeds = config.feeds.max
    if (!Supporter.enabled) {
      return maxFeeds
    }
    maxFeeds = data ? Math.max(maxFeeds, data.maxFeeds) : maxFeeds
    // Check the supporter for backwards compatibility
    const supporter = await this.getSupporter(this.id)
    if (!supporter) {
      return maxFeeds
    }
    const supporterMaxFeeds = await supporter.getMaxFeeds()
    return Math.max(maxFeeds, supporterMaxFeeds)
  }

  async hasSupporter () {
    if (!Supporter.enabled) {
      return false
    }
    return Supporter.hasValidGuild(this.id)
  }

  async isSubscriber () {
    if (!Supporter.enabled) {
      return false
    }
    return !!(await this.getSubscription())
  }

  async hasSupporterOrSubscriber () {
    return (await this.hasSupporter()) || (await this.isSubscriber())
  }

  static async getFastSupporterAndSubscriberGuildIds () {
    const supporterGuildIds = await Supporter.getValidFastGuilds()
    const subscriptionGuilds = await GuildSubscription.getAllSubscriptions()
    const subscriptionGuildIds = subscriptionGuilds
      .filter((guild) => !guild.slowRate)
      .map((s) => s.guildId)
    return new Set([...supporterGuildIds, ...subscriptionGuildIds])
  }
}

module.exports = Guild
