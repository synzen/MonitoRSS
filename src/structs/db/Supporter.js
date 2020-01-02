const Base = require('./Base')
const config = require('../../config.js')
const Patron = require('./Patron.js')
const SupporterModel = require('../../models/Supporter.js').model

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
    this.maxServers = this.getField('maxServers')

    /**
     * Only referenced for non-patrons
     * @type {number}
     */
    this.maxFeeds = this.getField('maxFeeds')

    /**
     * @type {string[]}
     */
    this.servers = this.getField('servers', [])

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

  static get compatible () {
    return Patron.compatible
  }

  /**
   * @returns {Supporter[]}
   */
  static async getValidSupporters () {
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
  static async getValidServers () {
    const servers = []
    const validSupporters = await this.getValidSupporters()
    validSupporters.forEach(supporter => {
      supporter.servers.forEach(id => servers.push(id))
    })
    return servers
  }

  /**
   * @param {string} serverId
   * @returns {boolean}
   */
  static async hasValidServer (serverId) {
    const servers = await this.getValidServers()
    return servers.includes(serverId)
  }

  /**
   * @returns {number}
   */
  async getMaxServers () {
    let patron
    if (this.patron) {
      patron = await Patron.getBy('discord', this._id)
    }
    if (patron) {
      return patron.determineMaxServers()
    } else {
      return this.maxServers || 1
    }
  }

  /**
   * @returns {number}
   */
  async getMaxFeeds () {
    let patron
    if (this.patron) {
      patron = await Patron.getBy('discord', this._id)
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
      patron = await Patron.getBy('discord', this._id)
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
      const patron = await Patron.getBy('discord', this._id)
      if (!patron) {
        return false
      } else {
        return patron.isActive()
      }
    }
  }

  toObject () {
    return {
      _id: this._id,
      patron: this.patron,
      webhook: this.webhook,
      maxServers: this.maxServers,
      maxFeeds: this.maxFeeds,
      servers: this.servers,
      expireAt: this.expireAt,
      comment: this.comment,
      slowRate: this.slowRate
    }
  }

  static get Model () {
    return SupporterModel
  }
}

module.exports = Supporter
