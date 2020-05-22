const Base = require('./Base.js')
const Feed = require('./Feed.js')
const FailRecordModel = require('../../models/FailRecord.js')
const getConfig = require('../../config.js').get

class FailRecord extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    if (!this._id) {
      throw new Error('_id is undefined (must be URL)')
    }

    /**
     * Last recorded reason of failure
     * @type {string}
     */
    this.reason = this.getField('reason')

    /**
     * The date the first failure occurred
     * @type {string}
     */
    this.failedAt = this.getField('failedAt', new Date().toISOString())

    /**
     * Whether an alert has been sent out for this. Only a
     * meta property. If true, this feed will be skipped
     * during cycles.
     * @type {boolean}
     */
    this.alerted = this.getField('alerted', false)
  }

  static get cutoff () {
    const config = getConfig()
    return config.feeds.hoursUntilFail
  }

  /**
   * Record the failure
   * @param {string} url - Feed URL
   * @param {string} reason - Reason to provide if failed
   * @returns {FailRecord}
   */
  static async record (url, reason) {
    const record = await FailRecord.get(url)
    if (!record) {
      const data = {
        _id: url,
        reason
      }
      const newRecord = new this(data)
      await newRecord.save()
      return newRecord
    }
    if (record.reason !== reason) {
      record.reason = reason
      await record.save()
    }
    return record
  }

  /**
   * Reset the record by deleting it
   * @param {string} url - Feed URL
   */
  static async reset (url) {
    const found = await FailRecord.get(url)
    if (found) {
      return found.delete()
    }
  }

  /**
   * If a URL has failed
   * @param {string} url
   */
  static async hasFailed (url) {
    const found = await FailRecord.get(url)
    if (!found) {
      return false
    } else {
      return found.hasFailed()
    }
  }

  toObject () {
    return {
      _id: this._id,
      reason: this.reason,
      failedAt: this.failedAt,
      alerted: this.alerted
    }
  }

  /**
   * Get all feeds with this URL
   */
  async getAssociatedFeeds () {
    return Feed.getManyBy('url', this._id)
  }

  /**
   * If past the cutoff date, then this URL should not be fetched
   * @returns {boolean}
   */
  pastCutoff () {
    if (FailRecord.cutoff === 0) {
      return false
    }
    const now = new Date()
    const failedAt = new Date(this.failedAt)
    const hoursDiff = (now.getTime() - failedAt.getTime()) / 36e5
    return hoursDiff >= FailRecord.cutoff
  }

  /**
   * If this URL should be considered failed. Determines whether
   * a feed will be fetched in FeedSchedule
   * @returns {boolean}
   */
  hasFailed () {
    return this.pastCutoff()
  }

  static get Model () {
    return FailRecordModel.Model
  }
}

module.exports = FailRecord
