const config = require('../../config.js')
const Base = require('./Base.js')
const Feed = require('./Feed.js')
const ipc = require('../../util/ipc.js')
const createLogger = require('../../util/logger/create.js')
const FailRecordModel = require('../../models/FailRecord.js').model

class FailRecord extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * Feed URL
     * @type {string}
     */
    this.url = this.getField('url')
    if (!this.url) {
      throw new Error('url is undefined')
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
     * Whether an alert has been sent out for this
     * @type {boolean}
     */
    this.alerted = this.getField('alerted', false)
  }

  static get cutoff () {
    return config.feeds.hoursUntilFail
  }

  /**
   * Record the failure
   * @param {string} url - Feed URL
   * @param {string} reason - Reason to provide if failed
   * @returns {FailRecord}
   */
  static async record (url, reason) {
    const record = await FailRecord.getBy('url', url)
    if (!record) {
      const data = {
        url,
        reason
      }
      const newRecord = new this(data)
      await newRecord.save()
      return newRecord
    }
    let save = false
    if (record.reason !== reason) {
      record.reason = reason
      save = true
    }
    if (record.pastCutoff() && !record.alerted) {
      FailRecord.sendFailMessage(url)
      record.alerted = true
      save = true
    }
    if (save) {
      await record.save()
    }
    return record
  }

  /**
   * Reset the record by deleting it
   * @param {string} url - Feed URL
   */
  static async reset (url) {
    const found = await FailRecord.getBy('url', url)
    if (found) {
      return found.delete()
    }
  }

  /**
   * If a URL has failed
   * @param {string} url
   */
  static async hasFailed (url) {
    const found = await FailRecord.getBy('url', url)
    if (!found) {
      return false
    } else {
      return found.hasFailed()
    }
  }

  toObject () {
    return {
      url: this.url,
      reason: this.reason,
      failedAt: this.failedAt,
      alerted: this.alerted
    }
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

  /**
   * @param {string} url
   */
  static sendFailMessage (url) {
    const log = createLogger()
    Feed.getManyBy('url', url)
      .then(feeds => {
        log.info(`Sending fail notification for ${url} to ${feeds.length} channels`)
        feeds.forEach(({ channel }) => {
          const message = `Feed <${url}> in channel <#${channel}> has reached the connection failure limit, and will not be retried until it is manually refreshed by any server using this feed. Use the \`list\` command in your server for more information.`
          ipc.sendChannelAlert(channel, message)
        })
      })
      .catch(err => {
        log.error(err, `Failed to get many feeds for sendFailMessage of ${url}`)
      })
  }

  static get Model () {
    return FailRecordModel
  }
}

module.exports = FailRecord
