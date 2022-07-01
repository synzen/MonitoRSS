const Profile = require('./db/Profile.js')
const Feed = require('./db/Feed.js')

class FeedData {
  /**
   * @param {Object<string, any>} data
   * @param {Feed} data.feed
   * @param {import('./Profile.js')} data.profile
   * @param {import('./Subscriber.js')[]} data.subscribers
   * @param {import('./FilteredFormat.js')[]} data.filteredFormats
   */
  constructor (data) {
    this.feed = data.feed
    if (!this.feed) {
      throw new TypeError('Missing feed for FeedData')
    }
    this.profile = data.profile
    this.subscribers = data.subscribers
    this.filteredFormats = data.filteredFormats
  }

  toObject () {
    return {
      ...this.feed.toObject(),
      profile: this.profile ? this.profile.toObject() : undefined,
      subscribers: this.subscribers.map(s => s.toObject()),
      filteredFormats: this.filteredFormats.map(f => f.toObject())
    }
  }

  toJSON () {
    return {
      ...this.feed.toJSON(),
      profile: this.profile ? this.profile.toJSON() : undefined,
      subscribers: this.subscribers.map(s => s.toJSON()),
      filteredFormats: this.filteredFormats.map(f => f.toJSON())
    }
  }

  /**
   * Get associated info of a feed, including profile, subscribers
   * and filtered formats
   * @param {Feed} feed
   */
  static async getFeedAssociations (feed) {
    const [
      profile,
      subscribers,
      filteredFormats
    ] = await Promise.all([
      Profile.get(feed.guild),
      feed.getSubscribers(),
      feed.getFilteredFormats()
    ])
    return {
      profile,
      subscribers,
      filteredFormats
    }
  }

  /**
   * Get a particular feed's data
   * @param {string} id
   */
  static async get (id) {
    /** @type {Feed} */
    const feed = await Feed.get(id)
    if (!feed) {
      return null
    }
    const {
      profile,
      subscribers,
      filteredFormats
    } = await FeedData.getFeedAssociations(feed)
    return {
      feed,
      profile,
      subscribers,
      filteredFormats
    }
  }

  /**
   * Get many feed datas
   * @param {string} field
   * @param {string} value
   */
  static async getManyBy (field, value) {
    const feeds = await Feed.getManyBy(field, value)
    const associations = await Promise.all(feeds.map(this.getFeedAssociations))
    return feeds.map((feed, i) => new FeedData({
      feed,
      profile: associations[i].profile,
      subscribers: associations[i].subscribers,
      filteredFormats: associations[i].filteredFormats
    }))
  }

  static async getManyByQuery (query) {
    const feeds = await Feed.getManyByQuery(query)
    const associations = await Promise.all(feeds.map(this.getFeedAssociations))
    return feeds.map((feed, i) => new FeedData({
      feed,
      profile: associations[i].profile,
      subscribers: associations[i].subscribers,
      filteredFormats: associations[i].filteredFormats
    }))
  }

  /**
   * Get all feed datas
   */
  static async getAll () {
    const feeds = await Feed.getAll()
    const associations = await Promise.all(feeds.map(this.getFeedAssociations))
    return feeds.map((feed, i) => new FeedData({
      feed,
      profile: associations[i].profile,
      subscribers: associations[i].subscribers,
      filteredFormats: associations[i].filteredFormats
    }))
  }

  /**
   * @param {import('./db/Feed.js')} feed
   */
  static async ofFeed (feed) {
    const associations = await this.getFeedAssociations(feed)
    return new FeedData({
      feed,
      ...associations
    })
  }
}

module.exports = FeedData
