const getConfig = require('../config').get
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
    return Supporter.getValidSupporterOfGuild(this.id)
  }

  async getSubscription () {
    return GuildSubscription.getSubscription(this.id)
  }

  async getMaxFeeds () {
    const config = getConfig()
    const data = await this.getSubscription(this.id)
    let maxFeeds = config.feeds.max
    maxFeeds = data ? Math.max(maxFeeds, data.maxFeeds) : maxFeeds
    // Check the supporter for backwards compatibility
    const supporter = await this.getSupporter(this.id)
    if (!supporter) {
      return maxFeeds
    }
    return Math.max(maxFeeds, await supporter.getMaxFeeds())
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
