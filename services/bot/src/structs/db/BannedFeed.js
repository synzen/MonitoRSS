const BannedFeedModel = require('../../models/BannedFeed.js')
const Base = require('./Base.js')

class BannedFeed extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * The URL of the feed
     * @type {string}
     */
    this.url = this.getField('url')
    if (this.url === undefined) {
      throw new TypeError('url is undefined')
    }

    /**
     * Optional name of the target
     * @type {string|undefined}
     */
    this.reason = this.getField('reason')

    /**
     * The guild IDs that this feed is banned in. If an empty array, it is banned in all guilds.
     * @type {string[]}
     */
    this.guildIds = this.getField('guildIds', [])
  }

  /**
   * Find if a url is banned in a guild.
   *
   * @param {string} url
   * @param {string} guildId
   * @returns {Promise<BannedFeed|null>}
   */
  static async findForUrl (url, guildId) {
    return BannedFeed.getByQuery({
      url: url,
      $or: [{
        guildIds: guildId
      }, {
        guildIds: {
          $size: 0
        }
      }]
    })
  }

  toObject () {
    return {
      url: this.url,
      reason: this.reason,
      guildIds: this.guildIds
    }
  }

  static get Model () {
    return BannedFeedModel.Model
  }
}

module.exports = BannedFeed
