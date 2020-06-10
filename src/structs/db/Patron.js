const path = require('path')
const Base = require('./Base.js')
const PatronModel = require('../../models/Patron.js')
const getConfig = require('../../config.js').get

class Patron extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    // _id is patron member ID
    if (!this._id) {
      throw new TypeError('_id is undefined')
    }

    /**
     * @type {string}
     */
    this.status = this.getField('status')

    /**
     * @type {string}
     */
    this.lastCharge = this.getField('lastCharge')

    /**
     * @type {number}
     */
    this.pledgeLifetime = this.getField('pledgeLifetime')
    if (this.pledgeLifetime === undefined) {
      throw new TypeError('pledgeLifetime is undefined')
    }

    /**
     * @type {number}
     */
    this.pledge = this.getField('pledge')
    if (this.pledge === undefined) {
      throw new TypeError('pledge is undefined')
    }

    /**
     * @type {string}
     */
    this.discord = this.getField('discord')

    /**
     * @type {string}
     */
    this.name = this.getField('name')

    /**
     * @type {string}
     */
    this.email = this.getField('email')
  }

  static async refresh () {
    const filePath = path.join(path.resolve(), 'settings', 'api.js')
    return require(filePath)()
  }

  toObject () {
    return {
      _id: this._id,
      status: this.status,
      lastCharge: this.lastCharge,
      pledgeLifetime: this.pledgeLifetime,
      pledge: this.pledge,
      discord: this.discord,
      name: this.name,
      email: this.email
    }
  }

  /**
   * @returns {boolean}
   */
  isActive () {
    const active = this.status === Patron.STATUS.ACTIVE
    if (active) {
      return true
    }
    const declined = this.status === Patron.STATUS.DECLINED
    if (!declined || !this.lastCharge) {
      return false
    }
    const now = new Date(new Date().toUTCString())
    const last = new Date(this.lastCharge)
    const diffTime = Math.abs(last - now)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays < 4
  }

  /**
   * @returns {number}
   */
  determineMaxFeeds () {
    const config = getConfig()
    if (!this.isActive()) {
      return config.feeds.max
    }
    if (this.pledge >= 2000) {
      return 140
    }
    if (this.pledge >= 1000) {
      return 70
    }
    if (this.pledge >= 500) {
      return 35
    }
    if (this.pledge >= 250) {
      return 15
    }
    return config.feeds.max
  }

  /**
   * @returns {number}
   */
  determineMaxGuilds () {
    if (!this.isActive()) {
      return 1
    }
    if (this.pledgeLifetime >= 2500) {
      return 4
    }
    if (this.pledgeLifetime >= 1500) {
      return 3
    }
    if (this.pledgeLifetime >= 500) {
      return 2
    }
    return 1
  }

  /**
   * @returns {number}
   */
  determineWebhook () {
    if (!this.isActive()) {
      return false
    } else {
      return this.pledge >= 100
    }
  }

  static get STATUS () {
    return {
      ACTIVE: 'active_patron',
      FORMER: 'former_patron',
      DECLINED: 'declined_patron'
    }
  }

  static get Model () {
    return PatronModel.Model
  }
}

module.exports = Patron
