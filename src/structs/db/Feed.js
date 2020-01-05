const Base = require('./Base.js')
const FilterBase = require('./FilterBase.js')
const FeedModel = require('../../models/Feed.js').model
const Format = require('./Format.js')
const Subscriber = require('./Subscriber.js')
const Schedule = require('./Schedule.js')
const AssignedSchedule = require('./AssignedSchedule.js')
const Supporter = require('./Supporter.js')
const debug = require('../../util/debugFeeds.js')
const log = require('../../util/logger.js')

class Feed extends FilterBase {
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
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * Optinal override for _id. Use for restoring from JSON
     * @type {string}
     */
    this._id = this.getField('_id')

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
     * Disabled status. Either undefined if enabled, or
     * a string stating the reason why.
     * @type {string}
     */
    this.disabled = this.getField('disabled')

    /**
     * This feed's webhook. Default value is an empty object,
     * as enforced by mongoose. Cannot be empty/null.
     * @type {Object<string, string>}
     */
    this._webhook = this.getField('webhook')

    /**
     * Split messages that are >2000 chars into multiple
     * messages
     * @type {Object<string, string|number>}
     */
    this._split = this.getField('split')
  }

  static get SPLIT_KEYS () {
    return ['char', 'prepend', 'append', 'maxLength']
  }

  static get WEBHOOK_KEYS () {
    return ['id', 'name', 'avatar']
  }

  toObject () {
    /**
     * Use this.webhook instead of this._webhook since mongoose
     * will return an empty object when we don't want it to
     */
    const data = {
      ...super.toObject(),
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
      webhook: this.webhook,
      split: this.split
    }
    if (this._id) {
      data._id = this._id
    }
    return data
  }

  /**
   * Webhook getter
   * @returns {Object<string, string>|undefined}
   */
  get webhook () {
    return Base.resolveObject(this._webhook)
  }

  /**
   * Split options getter
   * @returns {Object<string, string>|undefined}
   */
  get split () {
    return Base.resolveObject(this._split)
  }

  set webhook (value) {
    this._webhook = value
  }

  set split (value) {
    this._split = value
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
   * Gets the message format of this feed. There is only
   * one format per feed.
   * @returns {Format}
   */
  async getFormat () {
    return Format.getBy('feed', this._id)
  }

  /**
   * Returns both role and user subscribers of this feed.
   * @returns {Subscriber[]}
   */
  async getSubscribers () {
    return Subscriber.getManyBy('feed', this._id)
  }

  /**
   * Disable this feed
   * @param {string} reason
   */
  async disable (reason = 'No reason specified') {
    this.disabled = reason
    return this.save()
  }

  /**
   * Enable this feed
   */
  async enable () {
    this.disabled = undefined
    return this.save()
  }

  async delete () {
    const format = await this.getFormat()
    const subscribers = await this.getSubscribers()
    const toDelete = subscribers.map(sub => sub.delete())
    if (format) {
      toDelete.push(format.delete())
    }
    await Promise.all(toDelete)
    return super.delete()
  }

  /**
   * @param {string[]} [supporterGuilds] - Array of supporter guild IDs
   * @param {Schedule[]} [schedules] - All stored schedules
   */
  async determineSchedule (schedules, supporterGuilds) {
    if (!schedules) {
      schedules = await Schedule.getAll()
    }

    if (!supporterGuilds) {
      supporterGuilds = await Supporter.getValidGuilds()
    }

    // Take care of our supporters first
    if (Supporter.enabled && !this.url.includes('feed43')) {
      if (supporterGuilds.includes(this.guild)) {
        return Supporter.schedule.name
      }
    }

    for (const schedule of schedules) {
      if (schedule.name === 'default' || (Supporter.enabled && schedule.name === Supporter.schedule.name)) {
        continue
      }
      // Check if non-default schedules first
      // Feed IDs first
      const feedIDs = schedule.feeds // Potential array
      if (feedIDs && feedIDs.includes(this._id)) {
        return schedule.name
      }
      // keywords second
      const sKeywords = schedule.keywords
      if (!sKeywords) {
        continue
      }
      for (const word of sKeywords) {
        if (!this.url.includes(word)) {
          continue
        }
        return schedule.name
      }
    }

    return 'default'
  }

  /**
   * Remove the schedule of this feed
   * @param {number} shardID
   */
  async removeSchedule (shardID) {
    const assigned = await AssignedSchedule.getByFeedAndShard(this._id, shardID)
    if (!assigned) {
      return
    }
    // const shardID = this.bot.shard ? this.bot.shard.id : 0
    await assigned.delete()
  }

  /**
   * Assign a feed schedule
   * @param {number} shardID
   * @param {string[]} [supporterGuilds] - Array of supporter guild IDs
   * @param {Schedule[]} [schedules]
   * @returns {AssignedSchedule} - The assigned schedule
   */
  async assignSchedule (shardID, supporterGuilds, schedules) {
    const scheduleName = await this.determineSchedule(schedules, supporterGuilds)
    if (debug.feeds.has(this._id)) {
      log.debug.info(`${this._id}: Determined schedule is ${scheduleName}`)
    }
    const assigned = new AssignedSchedule({
      feed: this._id,
      schedule: scheduleName,
      url: this.url,
      guild: this.guild,
      shard: shardID
    })
    await assigned.save()
    return assigned
  }

  /**
   * Remove the current schedule and assign again. Used
   * be used when new schedules are added.
   * @param {number} shardID
   * @returns {AssignedSchedule} - The assigned schedule
   */
  async reassignSchedule (shardID) {
    await this.removeSchedule(shardID)
    return this.assignSchedule(shardID)
  }

  static get Model () {
    return FeedModel
  }
}

module.exports = Feed
