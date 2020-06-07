const Base = require('./Base.js')
const FilterBase = require('./FilterBase.js')
const FeedModel = require('../../models/Feed.js')
const FilteredFormat = require('./FilteredFormat.js')
const Subscriber = require('./Subscriber.js')
const Schedule = require('./Schedule.js')
const Supporter = require('./Supporter.js')
const FeedFetcher = require('../../util/FeedFetcher.js')
const databaseFuncs = require('../../util/database.js')
const createLogger = require('../../util/logger/create.js')

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
     * Allow direct subscribers through sub command
     * @type {boolean}
     */
    this.directSubscribers = this.getField('directSubscribers')

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
     * Additional negative-comparisons if default checks mark
     * an article as new. They'll mark an article ineligible
     * to be sent.
     * @type {string[]}
     */
    this.ncomparisons = this.getField('ncomparisons', [])

    /**
     * Additional positive-comparisons if default checks mark
     * an article as old. They'll mark an article eligible to
     * be sent.
     * @type {string[]}
     */
    this.pcomparisons = this.getField('pcomparisons', [])
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
      directSubscribers: this.directSubscribers,
      disabled: this.disabled,
      webhook: this.webhook,
      split: this.split,
      ncomparisons: this.ncomparisons,
      pcomparisons: this.pcomparisons,
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
      if (schedule.name === 'default') {
        continue
      }
      // Check if non-default schedules first
      // Feed IDs
      const feedIDs = schedule.feeds // Potential array
      if (feedIDs && feedIDs.includes(this._id)) {
        return schedule
      }
      // Keywords
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
   * @param {string} scheduleName
   * @param {Object<string, any>[]} articleList
   */
  async initializeArticles (scheduleName, articleList) {
    if (!Base.isMongoDatabase) {
      return
    }
    try {
      const docsByURL = await databaseFuncs.getAllDocuments(scheduleName)
      const docs = docsByURL[this.url] || []
      if (docs.length > 0) {
        // The collection already exists from a previous addition, no need to initialize
        return
      }
      const comparisons = [...this.ncomparisons, ...this.pcomparisons]
      const insert = []
      const meta = {
        scheduleName,
        feedURL: this.url
      }
      for (const article of articleList) {
        const formatted = databaseFuncs.formatArticleForDatabase(article, comparisons, meta)
        insert.push(formatted)
      }
      await databaseFuncs.insertDocuments(insert)
    } catch (err) {
      const log = createLogger()
      log.error(err, `Unable to initialize ${this.url}`)
    }
  }

  /**
   * Fetch the feed and see if it connects before actually saving
   */
  async testAndSave () {
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
    const allArticlesHaveDates = articleList.every(article => !!article.pubdate)
    if (!allArticlesHaveDates) {
      this.checkDates = false
    }
    await this.save()
    if (articleList.length > 0) {
      const schedule = await this.determineSchedule()
      await this.initializeArticles(schedule.name, articleList)
    }
  }

  validate () {
    FilteredFormat.pruneEmbeds(this.embeds)
    super.validate()
  }

  static get Model () {
    return FeedModel.Model
  }
}

module.exports = Feed
