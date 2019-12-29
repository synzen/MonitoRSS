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

  toObject () {
    return {
      url: this.url,
      count: this.count,
      reason: this.reason
    }
  }

  static get Model () {
    return FailCounterModel
  }
}

module.exports = FailCounter
