const Profile = require('./db/Profile.js')
const Feed = require('./db/Feed.js')
const Format = require('./db/Format.js')
const Subscriber = require('./db/Subscriber.js')
const log = require('../util/logger.js')

class GuildData {
  /**
   * @param {Object<string, any>} data
   * @param {Object<string, any>} data.profile
   * @param {Object<string, any>[]} data.feeds
   * @param {Object<string, any>[]} data.formats
   * @param {Object<string, any>[]} data.subscribers
   */
  constructor (data) {
    this.data = data
    const { profile, feeds, formats, subscribers } = data
    if (profile && !profile._id) {
      throw new Error(`Profile missing _id`)
    }
    const feedIDs = new Set()
    const guildIDs = new Set()
    for (const feed of feeds) {
      guildIDs.add(feed.guild)
      if (guildIDs.size > 1) {
        throw new Error(`Mismatched guild IDs found for feeds`)
      }
      feedIDs.add(feed._id)
      if (profile && feed.guild !== profile._id) {
        throw new Error(`Feed ${feed._id} does not match profile`)
      }
    }
    for (const format of formats) {
      if (!feedIDs.has(format.feed)) {
        throw new Error(`Format ${format._id} does not match any given feeds`)
      }
    }
    for (const subscriber of subscribers) {
      if (!feedIDs.has(subscriber.feed)) {
        throw new Error(`Subscriber ${subscriber._id} does not match any given feeds`)
      }
    }
    /**
     * The guild's ID.
     * @type {string}
     */
    this.id = Array.from(guildIDs.keys())[0]

    this.profile = profile
    this.feeds = feeds
    this.formats = formats
    this.subscribers = subscribers
  }

  /**
   * Gets all of a guild's data and returns a GuildData
   * @param {guildId} guildId
   * @returns {GuildData}
   */
  static async get (guildId) {
    const [ profile, feeds ] = await Promise.all([
      Profile.get(guildId),
      Feed.getManyBy('guild', guildId)
    ])
    const [ formats, feedSubscribers ] = await Promise.all([
      Promise.all(feeds.map(feed => feed.getFormat())),
      Promise.all(feeds.map(feed => feed.getSubscribers()))
    ])
    const allSubscribers = []
    feedSubscribers.forEach(subscribers => {
      subscribers.forEach(s => allSubscribers.push(s))
    })

    const data = {
      profile: profile ? profile.toJSON() : null,
      feeds: feeds.map(feed => feed.toJSON()),
      formats: formats.filter(f => f).map(f => f.toJSON()),
      subscribers: allSubscribers.map(s => s.toJSON())
    }
    return new GuildData(data)
  }

  toJSON () {
    return this.data
  }

  /**
   * If the GuildData has no profile and no feeds. If there are
   * no feeds, then there are also no formats or subscribers.
   * @returns {boolean}
   */
  isEmpty () {
    const { profile, feeds } = this
    const noProfile = !profile
    const noFeeds = feeds.length === 0
    return noProfile && noFeeds
  }

  /**
   * Deletes all associated data of this guild. Used to
   * delete any conflicting data before restoring
   */
  async delete () {
    const deletions = []
    if (this.profile) {
      const profile = await Profile.get(this.profile._id)
      if (profile) {
        deletions.push(profile.delete())
      }
    }
    const models = [Feed, Subscriber, Format]
    const toLoopOver = [this.feeds, this.subscribers, this.formats]
    for (let i = 0; i < toLoopOver.length; ++i) {
      const Model = models[i]
      const list = toLoopOver[i]
      for (const item of list) {
        const _id = item._id
        if (!_id) {
          continue
        }
        const found = await Model.get(_id)
        if (found) {
          deletions.push(found.delete())
        }
      }
    }
    await Promise.all(deletions)
  }

  /**
   * Restore this back to the database
   */
  async restore () {
    await this.delete()
    const feeds = []
    const formats = []
    const subscribers = []
    this.feeds.forEach(feed => {
      feeds.push(new Feed(feed))
    })
    this.formats.forEach(format => {
      formats.push(new Format(format))
    })
    this.subscribers.forEach(subscriber => {
      subscribers.push(new Subscriber(subscriber))
    })
    let data = this.profile ? [new Profile(this.profile)] : []
    data = data.concat(feeds)
      .concat(formats)
      .concat(subscribers)
    try {
      /**
       * Profile must be saved first otherwise the feed saving
       * middleware will throw an error saying the profile
       * does not exist
       */
      if (this.profile) {
        await data[0].save()
      }
      await Promise.all(feeds.map(f => f.save()))
      await Promise.all(formats.map(f => f.save()))
      await Promise.all(subscribers.map(s => s.save()))
    } catch (err) {
      Promise.all(data.map(d => d.delete()))
        .catch(err => log.general.error('Failed to rollback saves after GuildData restore', err))
      throw err
    }
  }
}

module.exports = GuildData
