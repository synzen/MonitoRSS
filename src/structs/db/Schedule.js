const Base = require('./Base.js')

class Schedule extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * Schedule name
     * @type {number}
     */
    this.name = this.getField('name')
    if (!this.name) {
      throw new Error('Undefined name')
    }

    /**
     * Refresh rate
     * @type {number}
     */
    this.refreshRateMinutes = this.getField('refreshRateMinutes')
    if (!this.refreshRateMinutes) {
      throw new Error('Undefined refreshRateMinutes')
    }

    /**
     * Keywords to match URLs by
     * @type {string[]}
     */
    this.keywords = this.getField('keywords', [])

    /**
     * Feed IDs to explicitly match to this schedule
     * @type {string[]}
     */
    this.feeds = this.getField('feeds', [])
  }

  toObject () {
    return {
      name: this.name,
      refreshRateMinutes: this.refreshRateMinutes,
      keywords: this.keywords,
      feeds: this.feeds
    }
  }
}

module.exports = Schedule
