const BannedFeedModel = require('../../models/BannedFeed.js')
const Base = require('./Base.js')

class BannedFeed extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * The URL of the feed
     * @type {string}
     */
    this.urlPattern = this.getField('urlPattern')
    if (this.urlPattern === undefined) {
      throw new TypeError('urlPattern is undefined')
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
   * Find if a urlPattern is banned in a guild.
   *
   * @param {string} urlPattern
   * @param {string} guildId
   * @returns {Promise<BannedFeed[]>}
   */
  static async findForUrl (urlPattern, guildId) {
    const patternToUse = urlPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    return BannedFeed.getByQuery({
      $text: {
        $search: patternToUse
      },
      $or: [{
        guildIds: {
          $in: [guildId]
        }
      }, {
        guildIds: {
          $size: 0
        }
      }]
    })
  }

  toObject () {
    return {
      urlPattern: this.urlPattern,
      reason: this.reason,
      guildIds: this.guildIds
    }
  }

  static get Model () {
    return BannedFeedModel.Model
  }
}

module.exports = BannedFeed
