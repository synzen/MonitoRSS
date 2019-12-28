const Base = require('./Base.js')
const AssignedScheduleModel = require('../../models/AssignedSchedule.js').model

class AssignedSchedule extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * Feed ID this schedule belongs to
     * @type {string}
     */
    this.feedID = this.getField('feedID')
    if (!this.feedID) {
      throw new Error('feedID is undefined')
    }

    /**
     * Guild ID this schedule belongs to
     * @type {string}
     */
    this.guildID = this.getField('guildID')
    if (!this.guildID) {
      throw new Error('guildID is undefined')
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

  toObject () {
    return {
      _id: this.feedID + this.shard,
      feedID: this.feedID,
      guildID: this.guildID,
      shard: this.shard,
      url: this.url,
      schedule: this.schedule
    }
  }

  async getByFeedAndShard (feedID, shard) {
    return AssignedSchedule.get(feedID + shard)
  }

  static get Model () {
    return AssignedScheduleModel
  }
}

module.exports = AssignedSchedule
