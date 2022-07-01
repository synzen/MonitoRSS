const Blacklist = require('./db/Blacklist.js')

class BlacklistCache {
  /**
   * Directly from the database
   * @param {import('./db/Blacklist.js')[]} blacklists
   */
  constructor (blacklists) {
    /**
     * Blacklisted user IDs
     * @type {Set<string>}
     */
    this.users = new Set()

    /**
     * Blacklisted guild IDs
     * @type {Set<string>}
     */
    this.guilds = new Set()

    for (const blacklist of blacklists) {
      switch (blacklist.type) {
        case Blacklist.TYPES.USER:
          this.users.add(blacklist.id)
          break
        case Blacklist.TYPES.GUILD:
          this.guilds.add(blacklist.id)
          break
        default:
      }
    }
  }
}

module.exports = BlacklistCache
