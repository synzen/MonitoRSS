const Base = require('./Base.js')
const GuildProfileModel = require('../../models/GuildProfile.js').model
const Feed = require('./Feed.js')

class GuildProfile extends Base {
  /**
   * @param {import('mongoose').Model|Object<string, any>} data - Data
   * @param {string} data._id - Guild ID
   * @param {string} data.name - Guild name
   * @param {string} data.dateFormat - Date format for date placeholders
   * @param {string} data.dateLanguage - Date language for date placeholders
   * @param {string} data.timezone - Date timezone for date placeholders
   * @param {string} data.prefix - Prefix for commands
   * @param {string} data.locale - Locale for commands
   */
  constructor (data) {
    super(data)

    if (!this._id) {
      throw new Error('Undefined _id')
    }

    /**
     * The guild's name
     * @type {string}
     */
    this.name = this.getField('name')
    if (!this.name) {
      throw new Error('Undefined name')
    }

    /**
     * Date format for date placeholders
     * @type {string}
     */
    this.dateFormat = this.getField('dateFormat')

    /**
     * Date language for date placeholders
     * @type {string}
     */
    this.dateLanguage = this.getField('dateLanguage')

    /**
     * Date timezone for date placeholders
     * @type {string}
     */
    this.timezone = this.getField('timezone')

    /**
     * Prefix for commands
     * @type {string}
     */
    this.prefix = this.getField('prefix')

    /**
     * Locale for commands
     * @type {string}
     */
    this.locale = this.getField('locale')

    /**
     * IDs of feeds that belong to this guild
     * @type {string[]}
     */
    this.feeds = this.getField('feeds', [])

    /**
     * User IDs to send alerts to
     * @type {string[]}
     */
    this.alert = this.getField('alert', [])
  }

  toObject () {
    return {
      _id: this._id,
      name: this.name,
      feeds: this.feeds,
      dateFormat: this.dateFormat,
      dateLanguage: this.dateLanguage,
      timezone: this.timezone,
      prefix: this.prefix,
      locale: this.locale,
      alert: this.alert
    }
  }

  /**
   * Return this guild's feeds
   * @type {import('./Feed.js')[]}
   */
  async getFeeds () {
    if (!this.isSaved()) {
      throw new Error('Must be saved before getting feeds')
    }
    return Promise.all(this.feeds.map(id => Feed.get(id)))
  }

  static get Model () {
    return GuildProfileModel
  }
}

module.exports = GuildProfile
