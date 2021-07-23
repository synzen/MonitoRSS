const Base = require('./Base.js')
const DebugFeedModel = require('../../models/DebugFeed.js')

class DebugFeed extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * The ID of the feed to debug
     * @type {string}
     */
    this.feedId = this.getField('feedId')
  }

  toObject () {
    return {
      _id: this._id,
      feedId: this.feedId
    }
  }

  static async getAllFeedIds () {
    const allDebugs = await this.getAll()
    return new Set(allDebugs.map((debug) => debug.feedId))
  }

  static get Model () {
    return DebugFeedModel.Model
  }
}

module.exports = DebugFeed
