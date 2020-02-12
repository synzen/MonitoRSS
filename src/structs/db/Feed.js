const Base = require('./Base.js')
const FilterBase = require('./FilterBase.js')
const FeedModel = require('../../models/Feed.js').model
const FilteredFormat = require('./FilteredFormat.js')
const Subscriber = require('./Subscriber.js')
const Schedule = require('./Schedule.js')
const Supporter = require('./Supporter.js')
const FeedFetcher = require('../../util/FeedFetcher.js')
const dbCmds = require('../../rss/db/commands.js')
const log = require('../../util/logger.js')

class Feed extends FilterBase {
  /**
   * @param {import('mongoose').Model|Object<string, any>} data - Data
   * @param {string} data.title - Feed meta title
   * @param {string} data.url - Feed URL
   * @param {string} data.guild - Guild ID
   * @param {string} data.channel - Channel ID
   * @param {Date} data.addedAt - Date the feed was added
   * @param {boolean} data.imgPreviews - Have Discord automatically show embeds for image links
   * @param {boolean} data.imgLinksExistence - Show image links in messages
   * @param {boolean} data.checkDates - Check dates for determining article newness
   * @param {boolean} data.formatTables - Format messages as if they're tables
   * @param {boolean} data.toggleRoleMentions - Toggle role mentions for subscribers when messages are sent
   * @param {string[]} data.checkProperties - Properties to check to decide if articles are new
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
    this.title = this.getField('title', 'Unknown')

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
     * Feed text message
     * @type {string}
     */
    this.text = this.getField('text')

    /**
     * Feed embeds
     * @type {Object<string, any>}
     */
    this.embeds = this.getField('embeds', [])

    /**
     * Date the feed was added. No need to initialize since
     * mongoose will add a default when it saves.
     * @type {Date}
     */
    this.addedAt = this.getField('addedAt')

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

    /**
     * RegexOps for custom placeholders
     * @type {Object<string, Object<string, any>[]>}
     */
    this.regexOps = this.getField('regexOps', {})

    /**
     * Properties for article comparisons
     * @type {string[]}
     */
    this.checkProperties = this.getField('checkProperties', [])
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
    const regexOpsMap = new Map()
    for (const key in this.regexOps) {
      regexOpsMap.set(key, this.regexOps[key])
    }
    const data = {
      ...super.toObject(),
      title: this.title,
      url: this.url,
      guild: this.guild,
      channel: this.channel,
      text: this.text,
      embeds: this.embeds,
      addedAt: this.addedAt,
      checkDates: this.checkDates,
      imgPreviews: this.imgPreviews,
      imgLinksExistence: this.imgLinksExistence,
      formatTables: this.formatTables,
      toggleRoleMentions: this.toggleRoleMentions,
      disabled: this.disabled,
      webhook: this.webhook,
      split: this.split,
      checkProperties: this.checkProperties,
      regexOps: regexOpsMap
    }
    if (this._id) {
      data._id = this._id
    }
    return data
  }

  toJSON () {
    return {
      ...super.toJSON(),
      regexOps: this.regexOps
    }
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
   * Returns both role and user subscribers of this feed.
   * @returns {Subscriber[]}
   */
  async getSubscribers () {
    return Subscriber.getManyBy('feed', this._id)
  }

  /**
   * Returns all the filtered formats of this feed
   * @returns {FilteredFormat[]}
   */
  async getFilteredFormats () {
    return FilteredFormat.getManyBy('feed', this._id)
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
    const subscribers = await this.getSubscribers()
    const filteredFormats = await this.getFilteredFormats()
    const toDelete = subscribers.map(sub => sub.delete())
      .concat(filteredFormats.map(f => f.delete()))
    await Promise.all(toDelete)
    return super.delete()
  }

  /**
   * @param {Schedule[]} [schedules] - All stored schedules
   * @param {string[]} [supporterGuilds] - Array of supporter guild IDs
   * @returns {Schedule}
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
        return Supporter.schedule
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
        return schedule
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
        return schedule
      }
    }

    return schedules.find(s => s.name === 'default')
  }

  /**
   * @param {number} shardID
   * @param {string} scheduleName
   * @param {Object<string, any>[]} articleList
   */
  async initializeArticles (shardID, scheduleName, articleList) {
    if (!Base.isMongoDatabase) {
      return
    }
    if (shardID === undefined) {
      throw new TypeError('shardID is undefined trying to initialize collection')
    }
    try {
      const docs = await dbCmds.findAll(null, this.url, shardID, scheduleName)
      if (docs.length > 0) {
        // The collection already exists from a previous addition, no need to initialize
        return
      }
      dbCmds.bulkInsert(null, articleList, this.url, shardID, scheduleName)
      await dbCmds.bulkInsert(Feed, articleList)
    } catch (err) {
      log.general.warning(`Unable to initialize ${this.url}`, err, true)
    }
  }

  /**
   * Fetch the feed and see if it connects before actually saving
   * @param {number} [shardID] - Used for initializing its Mongo collection
   */
  async testAndSave (shardID) {
    const { articleList } = await FeedFetcher.fetchFeed(this.url)
    const feeds = await Feed.getManyBy('guild', this.guild)
    for (const feed of feeds) {
      if (feed.url === this.url && feed.channel === this.channel) {
        const err = new Error('Already exists for this channel.')
        err.code = 40003
        err.type = 'resolved'
        throw err
      }
    }
    if (this.title === 'Unknown' && articleList.length > 0 && articleList[0].meta.title) {
      this.title = articleList[0].meta.title
    }
    if (this.title.length > 200) {
      this.title = this.title.slice(0, 200) + '...'
    }
    const allArticlesHaveDates = articleList.reduce((acc, article) => acc && (!!article.pubdate), true)
    if (!allArticlesHaveDates) {
      this.checkDates = false
    }
    await this.save()
    if (shardID !== undefined && articleList.length > 0) {
      const schedule = this.determineSchedule()
      await this.initializeArticles(shardID, schedule.name, articleList)
    }
  }

  validate () {
    FilteredFormat.pruneEmbeds(this.embeds)
    super.validate()
  }

  static get Model () {
    return FeedModel
  }
}

module.exports = Feed
