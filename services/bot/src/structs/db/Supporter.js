const Base = require('./Base')
const Patron = require('./Patron.js')
const SupporterModel = require('../../models/Supporter.js')
const getConfig = require('../../config.js').get

class Supporter extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    // _id is the discord id
    if (!this._id) {
      throw new TypeError('_id is undefined')
    }

    /**
     * @type {boolean}
     */
    this.patron = this.getField('patron')

    /**
     * Only referenced for non-patrons
     * @type {boolean}
     */
    this.webhook = this.getField('webhook')

    /**
     * Only referenced for non-patrons
     * @type {number}
     */
    this.maxGuilds = this.getField('maxGuilds')

    /**
     * Only referenced for non-patrons
     * @type {number}
     */
    this.maxFeeds = this.getField('maxFeeds')

    /**
     * @type {string[]}
     */
    this.guilds = this.getField('guilds', [])

    /**
     * @type {string}
     */
    this.expireAt = this.getField('expireAt')

    /**
     * @type {string}
     */
    this.comment = this.getField('comment')

    /**
     * @type {boolean}
     */
    this.slowRate = this.getField('slowRate')
  }

  static get keys () {
    return {
      ENABLED: '_vip',
      RESTRICTED: '_vipRestricted',
      REFRESH_RATE: '_vipRefreshRateMinutes'
    }
  }

  static get schedule () {
    const config = getConfig()
    return {
      name: 'supporter',
      refreshRateMinutes: config[this.keys.REFRESH_RATE]
    }
  }

  /**
   * @returns {boolean}
   */
  static get enabled () {
    const config = getConfig()
    return config[this.keys.ENABLED] === true
  }

  /**
   * If only supporters may have access to this bot.
   * @returns {true}
   */
  static get restricted () {
    const config = getConfig()
    return config[this.keys.RESTRICTED] === true
  }

  /**
   * @returns {Supporter[]}
   */
  static async getValidSupporters () {
    if (!Supporter.enabled) {
      return []
    }
    const supporters = await this.getAll()
    const promises = []
    for (const supporter of supporters) {
      promises.push(supporter.isValid())
    }
    const statuses = await Promise.all(promises)
    return supporters.filter((supporter, index) => statuses[index])
  }

  /**
   * @returns {string[]}
   */
  static async getValidGuilds () {
    const guilds = []
    const validSupporters = await this.getValidSupporters()
    validSupporters.forEach(supporter => {
      supporter.guilds.forEach(id => guilds.push(id))
    })
    return guilds
  }

  static async getValidFastGuilds () {
    const guilds = []
    const validSupporters = await this.getValidSupporters()
    const hasSlowRates = await Promise.all(validSupporters.map(supporter => supporter.hasSlowRate()))
    validSupporters
      .filter((supporter, index) => !hasSlowRates[index])
      .forEach((supporter, index) => {
        supporter.guilds.forEach(id => guilds.push(id))
      })
    return guilds
  }

  /**
   * @param {string} guildId
   * @returns {Supporter|null}
   */
  static async getValidSupporterOfGuild (guildId) {
    if (!Supporter.enabled) {
      return null
    }
    /**
     * @type {Supporter[]}
     */
    const supporters = await this.getManyByQuery({
      guilds: {
        $in: [guildId]
      }
    })
    const validStatuses = await Promise.all(supporters.map(s => s.isValid()))
    const validSupporter = supporters.find((supporter, index) => validStatuses[index])
    return validSupporter || null
  }

  /**
   * @param {string} guildId
   * @returns {boolean}
   */
  static async hasValidGuild (guildId) {
    const guilds = await this.getValidGuilds()
    return guilds.includes(guildId)
  }

  async findActivePatron () {
    const patrons = await Patron.getManyBy('discord', this._id)
    return patrons.find(patron => patron.isActive())
  }

  /**
   * @returns {number}
   */
  async getMaxGuilds () {
    let patron
    if (this.patron) {
      patron = await this.findActivePatron()
    }
    if (patron) {
      return patron.determineMaxGuilds()
    } else {
      return this.maxGuilds || 1
    }
  }

  /**
   * @returns {number}
   */
  async getMaxFeeds () {
    const config = getConfig()
    let patron
    if (this.patron) {
      patron = await this.findActivePatron()
    }
    if (patron) {
      return patron.determineMaxFeeds()
    } else {
      if (this.maxFeeds) {
        if (config.feeds.max > this.maxFeeds) {
          return config.feeds.max
        } else {
          return this.maxFeeds
        }
      } else {
        return config.feeds.max
      }
    }
  }

  /**
   * @returns {boolean}
   */
  async getWebhookAccess () {
    let patron
    if (this.patron) {
      patron = await this.findActivePatron()
    }
    if (patron) {
      return patron.determineWebhook()
    } else {
      return this.webhook
    }
  }

  /**
   * @returns {boolean}
   */
  async isValid () {
    if (!this.patron) {
      if (!this.expireAt) {
        return true
      } else {
        const now = new Date()
        const expire = new Date(this.expireAt)
        return now.getTime() < expire.getTime()
      }
    } else {
      return !!(await this.findActivePatron())
    }
  }

  async hasSlowRate () {
    // Slow rates may override patron settings
    if (this.patron && this.slowRate !== true) {
      /** @type {import('./Patron')|undefined} */
      const patron = await this.findActivePatron()
      if (patron) {
        return patron.pledge < Patron.SLOW_THRESHOLD
      } else {
        return this.slowRate
      }
    } else {
      return this.slowRate
    }
  }

  toObject () {
    return {
      _id: this._id,
      patron: this.patron,
      webhook: this.webhook,
      maxGuilds: this.maxGuilds,
      maxFeeds: this.maxFeeds,
      guilds: this.guilds,
      expireAt: this.expireAt,
      comment: this.comment,
      slowRate: this.slowRate
    }
  }

  static get Model () {
    return SupporterModel.Model
  }
}

module.exports = Supporter
