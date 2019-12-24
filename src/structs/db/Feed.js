const Base = require('./Base.js')
const FeedModel = require('../../models/Feed.js').model
const log = require('../../util/logger.js')
const dbOpsSchedules = require('../../util/db/schedules.js')
const ArticleModel = require('../../models/Article.js')

class Feed extends Base {
  /**
   * @param {import('mongoose').Model|Object<string, any>} data - Data
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
    this.checkTitles = this.getField('checkTitles')

    /**
     * Have Discord automatically show embeds for image links
     * @type {boolean}
     */
    this.imgPreviews = this.getField('imgPreviews')

    /**
     * Show image links in messages
     * @type {boolean}
     */
    this.imgLinksExistence = this.getField('imgLinksExistence')

    /**
     * Check dates for determining article newness
     * @type {boolean}
     */
    this.checkDates = this.getField('checkDates')

    /**
     * Format messages as if they're tables
     * @type {boolean}
     */
    this.formatTables = this.getField('formatTables')

    /**
     * Toggle role mentions for subscribers when messages
     * are sent
     * @type {boolean}
     */
    this.toggleRoleMentions = this.getField('toggleRoleMentions')

    /**
     * Disabled status
     * @type {String}
     */
    this.disabled = this.getField('disabled')

    /**
     * This feed's webhook. Default value is an empty object,
     * as enforced by mongoose. Cannot be empty/null.
     * @type {Object<string, string>}
     */
    this._webhook = this.getField('webhook')
  }

  toObject () {
    /**
     * Use this.webhook instead of this._webhook since mongoose
     * will return an empty object when we don't want it to
     */
    return {
      title: this.title,
      url: this.url,
      guild: this.guild,
      channel: this.channel,
      addedAt: this.addedAt,
      checkTitles: this.checkTitles,
      checkDates: this.checkDates,
      imgPreviews: this.imgPreviews,
      imgLinksExistence: this.imgLinksExistence,
      formatTables: this.formatTables,
      toggleRoleMentions: this.toggleRoleMentions,
      disabled: this.disabled,
      webhook: this.webhook
    }
  }

  /**
   * The feed's webhook getter. Returns undefined if the
   * this._webhook is empty.
   * @returns {Object<string, string>|undefined}
   */
  get webhook () {
    if (!this._webhook || Object.keys(this._webhook).length === 0) {
      return undefined
    } else {
      return this._webhook
    }
  }

  set webhook (value) {
    if (typeof value !== 'object') {
      throw new Error('Webhook must be an object')
    }
    if (!value.id) {
      throw new Error('id must be specified')
    }
    this._webhook = {
      id: value.id
    }
    if (value.name) {
      this._webhook.name = value.name
    }
    if (value.avatar) {
      this._webhook.avatar = value.avatar
    }
  }

  /**
   * Remove the feed and delete its schedule
   * @param {string} shardID
   */
  async remove (shardID) {
    await this.delete()
    await this.removeSchedule(shardID)
  }

  /**
   * Remove the schedule of this feed
   * @param {string} shardID
   */
  async removeSchedule (shardID) {
    const assigned = await dbOpsSchedules.assignedSchedules.get(this.id)
    if (!assigned) {
      return
    }
    // const shardID = this.bot.shard ? this.bot.shard.id : 0
    await dbOpsSchedules.assignedSchedules.remove(this.id)
    const assignedSchedules = await dbOpsSchedules.assignedSchedules.getMany(shardID, assigned.schedule, this.url)
    if (assignedSchedules.length === 0 && Base.isMongoDatabase) {
      ArticleModel.model(this.url, shardID, assigned.schedule).collection.drop().catch(err => err.code === 26 ? null : log.general.error('Failed to drop unused collection after feed removal', err))
    }
  }

  static get Model () {
    return FeedModel
  }
}

module.exports = Feed
