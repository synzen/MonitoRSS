const Profile = require('./Profile.js')
const Feed = require('./Feed.js')

class FeedData extends Feed {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * @type {import('./Profile.js')}
     */
    this.profile = undefined

    /**
     * @type {import('./Subscriber.js')[]}
     */
    this.subscribers = []

    /**
     * @type {import('./FilteredFormat.js')[]}
     */
    this.filteredFormats = []
  }

  async _populate () {
    const [
      profile,
      subscribers,
      filteredFormats
    ] = await Promise.all([
      Profile.get(this.guild),
      this.getSubscribers(),
      this.getFilteredFormats()
    ])
    this.profile = profile
    this.subscribers = subscribers
    this.filteredFormats = filteredFormats
  }

  toObject () {
    return {
      ...super.toObject(),
      profile: this.profile ? this.profile.toObject() : undefined,
      subscribers: this.subscribers.map(s => s.toObject()),
      filteredFormats: this.filteredFormats.map(f => f.toObject())
    }
  }

  toJSON () {
    return {
      ...super.toJSON(),
      profile: this.profile ? this.profile.toJSON() : undefined,
      subscribers: this.subscribers.map(s => s.toJSON()),
      filteredFormats: this.filteredFormats.map(f => f.toJSON())
    }
  }

  static async get (id) {
    const found = await super.get(id)
    if (found) {
      await found._populate()
    }
    return found
  }

  static async getByQuery (data) {
    const found = await super.getByQuery(data)
    if (found) {
      await found._populate()
    }
    return found
  }

  static async getManyByQuery (data) {
    const found = await super.getManyByQuery(data)
    const promises = []
    for (const f of found) {
      promises.push(f._populate())
    }
    await Promise.all(promises)
    return found
  }

  static async getAll () {
    const found = await super.getAll()
    const promises = []
    for (const f of found) {
      promises.push(f._populate())
    }
    await Promise.all(promises)
    return found
  }
}

module.exports = FeedData
