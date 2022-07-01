const Base = require('./Base.js')
const ProfileModel = require('../../models/Profile.js')

class Profile extends Base {
  /**
   * @param {import('mongoose').Model|Object<string, any>} data - Data
   * @param {string} data._id - Guild ID
   * @param {string} data.name - Guild name
   * @param {string} data.dateFormat - Date format for date placeholders
   * @param {string} data.dateLanguage - Date language for date placeholders
   * @param {string} data.timezone - Date timezone for date placeholders
   * @param {string} data.prefix - Prefix for commands
   * @param {string} data.locale - Locale for commands
   */
  constructor (data, _saved) {
    super(data, _saved)

    if (!this._id) {
      throw new Error('Undefined _id')
    }

    /**
     * The guild's name
     * @type {string}
     */
    this.name = this.getField('name')
    if (!this.name) {
      throw new Error('Undefined name')
    }

    /**
     * Date format for date placeholders
     * @type {string}
     */
    this.dateFormat = this.getField('dateFormat')

    /**
     * Date language for date placeholders
     * @type {string}
     */
    this.dateLanguage = this.getField('dateLanguage')

    /**
     * Date timezone for date placeholders
     * @type {string}
     */
    this.timezone = this.getField('timezone')

    /**
     * Prefix for commands
     * @type {string}
     */
    this.prefix = this.getField('prefix')

    /**
     * Locale for commands
     * @type {string}
     */
    this.locale = this.getField('locale')

    /**
     * User IDs to send alerts to
     * @type {string[]}
     */
    this.alert = this.getField('alert', [])
  }

  /**
   * Store all guild prefixes for reference by commands
   */
  static async populatePrefixes () {
    const profiles = await this.getAll()
    this.prefixes.clear()
    for (const profile of profiles) {
      if (profile.prefix) {
        this.setPrefix(profile._id, profile.prefix)
      }
    }
  }

  /**
   * Cache a guild's prefix
   * @param {string} guildID
   * @param {string} prefix
   */
  static setPrefix (guildID, prefix) {
    this.prefixes.set(guildID, prefix)
  }

  /**
   * Delete a guild's prefix from cache
   * @param {string} guildID
   */
  static deletePrefix (guildID) {
    this.prefixes.delete(guildID)
  }

  /**
   * Get a guild's cached prefix
   * @param {string} guildID
   */
  static getPrefix (guildID) {
    return this.prefixes.get(guildID)
  }

  /**
   * Getter for this._id since _id and id should be
   * the same.
   * @returns {string}
   */
  get id () {
    return this.getField('_id')
  }

  /**
   * Save and cache a new prefix
   * @param {string} prefix
   */
  async setPrefixAndSave (prefix) {
    this.prefix = prefix
    await this.save()
    if (prefix) {
      Profile.setPrefix(this._id, prefix)
    } else {
      Profile.deletePrefix(this._id)
    }
  }

  toObject () {
    return {
      _id: this._id,
      name: this.name,
      dateFormat: this.dateFormat,
      dateLanguage: this.dateLanguage,
      timezone: this.timezone,
      prefix: this.prefix,
      locale: this.locale,
      alert: this.alert
    }
  }

  static get Model () {
    return ProfileModel.Model
  }
}

/**
 * Cached prefixes of all guilds, used for commands
 * @type {Map<string, string>}
 */
Profile.prefixes = new Map()

module.exports = Profile
