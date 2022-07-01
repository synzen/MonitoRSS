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
     * Due to inconsistencies in Patreon's API, the pledge status doesn't seem to be up to date.
     *
     * This is a temporary measure until payments are moved off of Patreon.
     *
     * @type {string|undefined}
     */
    this.statusOverride = this.getField('statusOverride')

    /**
     * @type {string}
     */
    this.status = this.statusOverride || this.getField('status')

    /**
     * @type {string}
     */
    this.lastCharge = this.getField('lastCharge')

    /**
     * Due to inconsistencies in Patreon's API, the pledge lifetime doesn't seem to be up to date.
     *
     * This is a temporary measure until payments are moved off of Patreon.
     *
     * @type {number|undefined}
     */
    this.pledgeLifetimeOverride = this.getField('pledgeLifetimeOverride')

    /**
     * @type {number}
     */
    this.pledgeLifetime = this.pledgeLifetimeOverride || this.getField('pledgeLifetime')
    if (this.pledgeLifetime === undefined) {
      throw new TypeError('pledgeLifetime is undefined')
    }

    /**
     * Due to Patreon's unmaintained API, some people who paid 5 USD in a different currency such
     * as 4.5 euros will not receive the 5 USD benefits since Patreon reports the pldge as 4.5.
     *
     * This is a temporary measure until payments are moved off of Patreon.
     *
     * @type {number|undefined}
     */
    this.pledgeOverride = this.getField('pledgeOverride')

    /**
     * @type {number}
     */
    this.pledge = this.pledgeOverride || this.getField('pledge')
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

  static get SLOW_THRESHOLD () {
    return 500
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
      pledgeLifetimeOverride: this.pledgeLifetimeOverride,
      pledgeLifetime: this.pledgeLifetime,
      pledgeOverride: this.pledgeOverride,
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
    // As Patreon's API degrades, their status can be active even though it's not - in that case, the pledge may be 0
    const active = this.status === Patron.STATUS.ACTIVE && this.pledge > 0
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
    const pledge = this.pledge
    if (pledge >= 2000) {
      return 140
    }
    if (pledge >= 1500) {
      return 105
    }
    if (pledge >= 1000) {
      return 70
    }
    if (pledge >= 500) {
      return 35
    }
    if (pledge >= 250) {
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
