const config = require('../../config.js')
const Base = require('./Base.js')
const Feed = require('./Feed.js')
const log = require('../../util/logger.js')
const FailCounterModel = require('../../models/FailCounter.js').model

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

    /**
     * The date failure occurred
     * @type {string}
     */
    this.failedAt = this.getField('failedAt')
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
      return newCounter.increment()
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

  /**
   * If a URL has failed
   * @param {string} url
   */
  static async hasFailed (url) {
    const found = await FailCounter.getBy('url', url)
    if (!found) {
      return false
    } else {
      return found.hasFailed()
    }
  }

  toObject () {
    return {
      url: this.url,
      count: this.count,
      reason: this.reason,
      failedAt: this.failedAt
    }
  }

  /**
   * Whether this counter has reached the failure threshold
   */
  hasFailed () {
    return FailCounter.limit !== 0 && this.count >= FailCounter.limit
  }

  /**
   * Increment counter, or fail if it reeaches the limit
   * or above.
   * @param {string} reason - Why the url failed
   */
  async increment (reason) {
    ++this.count
    if (this.hasFailed()) {
      return this.fail(reason)
    } else {
      return this.save()
    }
  }

  /**
   * Fail a link by providing a reason
   * @param {string} reason
   */
  async fail (reason) {
    let save = false
    if (!this.failedAt) {
      this.failedAt = new Date().toISOString()
      FailCounter.sendFailMessage(this.url)
      save = true
    }
    if (this.count !== FailCounter.limit) {
      this.count = FailCounter.limit
      save = true
    }
    if (this.reason !== reason) {
      this.reason = reason
      save = true
    }
    if (save) {
      return this.save()
    }
  }

  /**
   * @param {string} url
   */
  static sendFailMessage (url) {
    if (config.dev === true) {
      return
    }
    Feed.getManyBy('url', url)
      .then(feeds => {
        log.general.info(`Sending fail notification for ${url} to ${feeds.length} channels`)
        feeds.forEach(({ channel }) => {
          const message = `**ATTENTION** - Feed url <${url}> in channel <#${channel}> has reached the connection failure limit, and will not be retried until it is manually refreshed by this server, or another server using this feed. Use the \`list\` command in your server for more information.`
          process.send({
            _drss: true,
            _loopback: true,
            type: 'sendMessage',
            channel,
            message
          })
        })
      })
      .catch(err => {
        log.general.error(`Failed to get many feeds for sendFailMessage of ${url}`, err, true)
      })
  }

  static get Model () {
    return FailCounterModel
  }
}

module.exports = FailCounter
