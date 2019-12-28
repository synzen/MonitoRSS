const Base = require('./Base.js')
const AssignedScheduleModel = require('../../models/AssignedSchedule.js').model

class AssignedSchedule extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * Feed ID this schedule belongs to
     * @type {string}
     */
    this.feed = this.getField('feed')
    if (!this.feed) {
      throw new Error('feed is undefined')
    }

    /**
     * Guild ID this schedule belongs to
     * @type {string}
     */
    this.guild = this.getField('guild')
    if (!this.guild) {
      throw new Error('guild is undefined')
    }

    /**
     * The shard the guild of this feed is on
     * @type {number}
     */
    this.shard = this.getField('shard')
    if (this.shard === undefined) {
      throw new Error('shard is undefined')
    }

    /**
     * URL
     */
    this.url = this.getField('url')
    if (!this.url) {
      throw new Error('url is undefined')
    }

    /**
     * Schedule name
     */
    this.schedule = this.getField('schedule')
    if (!this.schedule) {
      throw new Error('schedule is undefined')
    }
  }

  /**
   * Get an AssignedSchedule via composite key
   * @param {string} feedID
   * @param {number} shard
   */
  static async getByFeedAndShard (feedID, shard = '') {
    return AssignedSchedule.get(feedID + shard)
  }

  /**
   * Get an AssignedSchedule via multiple composite keys
   * @param {Object<string, string|number>[]} objects
   */
  static async getManyByFeedAndShard (objects) {
    const ids = objects.map(object => object.feed + object.shard)
    return AssignedSchedule.getManyBy(ids)
  }

  toObject () {
    return {
      _id: this.feed + this.shard.toString(),
      feed: this.feed,
      guild: this.guild,
      shard: this.shard,
      url: this.url,
      schedule: this.schedule
    }
  }

  static get Model () {
    return AssignedScheduleModel
  }
}

module.exports = AssignedSchedule
