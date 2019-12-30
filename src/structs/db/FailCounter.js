const config = require('../../config.js')
const Base = require('./Base.js')
const FailCounterModel = require('../../models/FailCounter.js')

class FailCounter extends Base {
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
     * Number of times fetch has failed
     * @type {number}
     */
    this.count = this.getField('count', 0)

    /**
     * Last recorded reason of failure
     * @type {string}
     */
    this.reason = this.getField('reason')
  }

  static get limit () {
    return config.feeds.failLimit
  }

  /**
   * Increment the fail counter, or fail it if it reached
   * the limit
   * @param {string} url - Feed URL
   * @param {string} reason - Reason to provide if failed
   */
  static async increment (url, reason) {
    const found = await FailCounter.getBy('url', url)
    if (!found) {
      const data = {
        url
      }
      const newCounter = new this(data)
      return newCounter.save()
    } else {
      return found.increment(reason)
    }
  }

  /**
   * Reset the counter by deleting it
   * @param {string} url - Feed URL
   */
  static async reset (url) {
    const found = await FailCounter.getBy('url', url)
    if (found) {
      return found.delete()
    }
  }

  toObject () {
    return {
      url: this.url,
      count: this.count,
      reason: this.reason
    }
  }

  /**
   * Whether this counter has reached the failure threshold
   */
  hasFailed () {
    return this.count >= FailCounter.limit
  }

  /**
   * Increment counter, or fail if it reeaches the limit
   * or above.
   * @param {string} reason - Why the url failed
   */
  async increment (reason) {
    if (this.hasFailed()) {
      return this.fail(reason)
    } else {
      ++this.count
      return this.save()
    }
  }

  /**
   * Fail a link by providing a reason
   * @param {string} reason
   */
  async fail (reason) {
    if (this.reason !== reason) {
      this.reason = reason
      return this.save()
    }
  }

  static get Model () {
    return FailCounterModel
  }
}

module.exports = FailCounter
