const Base = require('./Base.js')
const FeedModel = require('../../models/Feed.js')

class Feed extends Base {
  /**
   * @param {import('mongoose').Model|Object} data - Data
   * @param {string} data.title - Feed meta title
   * @param {string} data.url - Feed URL
   * @param {string} data.guild - Guild ID
   * @param {string} data.channel - Channel ID
   * @param {Date} data.addedAt - Date the feed was added
   * @param {boolean} data.checkTitles - Check titles for determining article newness
   * @param {boolean} data.imgPreviews - Have Discord automatically show embeds for image links
   * @param {boolean} data.imgLinksExistence - Show image links in messages
   * @param {boolean} data.checkDates - Check dates for determining article newness
   * @param {boolean} data.formatTables - Format messages as if they're tables
   * @param {boolean} data.toggleRoleMentions - Toggle role mentions for subscribers when messages are sent
   */
  constructor (data) {
    super(data)

    /**
     * Feed name
     * @type {string}
     */
    this.title = this.getField('title')
    if (!this.title) {
      throw new Error('Undefined title')
    }

    /**
     * Feed URL
     * @type {string}
     */
    this.url = this.getField('url')
    if (!this.url) {
      throw new Error('Undefined url')
    }

    /**
     * Guild ID
     * @type {string}
     */
    this.guild = this.getField('guild')
    if (!this.guild) {
      throw new Error('Undefined guild')
    }

    /**
     * Feed channel ID
     * @type {string}
     */
    this.channel = this.getField('channel')
    if (!this.channel) {
      throw new Error('Undefined channel')
    }

    /**
     * Date the feed was added. No need to initialize since
     * mongoose will add a default when it saves.
     * @type {Date}
     */
    this.addedAt = this.getField('addedAt')

    /**
     * Check titles for determining article newness
     * @type {boolean}
     */
    this.checkTitles = this.getField('checkTitles', false)

    /**
     * Have Discord automatically show embeds for image links
     * @type {boolean}
     */
    this.imgPreviews = this.getField('imgPreviews', true)

    /**
     * Show image links in messages
     * @type {boolean}
     */
    this.imgLinksExistence = this.getField('imgLinksExistence', true)

    /**
     * Check dates for determining article newness
     * @type {boolean}
     */
    this.checkDates = this.getField('checkDates', false)

    /**
     * Format messages as if they're tables
     * @type {boolean}
     */
    this.formatTables = this.getField('formatTables', false)

    /**
     * Toggle role mentions for subscribers when messages
     * are sent
     * @type {boolean}
     */
    this.toggleRoleMentions = this.getField('toggleRoleMentions', false)
  }

  toObject () {
    return {
      title: this.title,
      url: this.url,
      channel: this.channel,
      addedAt: this.addedAt,
      checkTitles: this.checkTitles,
      checkDates: this.checkDates,
      imgPreviews: this.imgPreviews,
      imgLinksExistence: this.imgLinksExistence,
      formatTables: this.formatTables,
      toggleRoleMentions: this.toggleRoleMentions
    }
  }

  static Model () {
    return FeedModel.model
  }
}

module.exports = Feed
