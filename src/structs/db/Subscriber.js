const FilterBase = require('./FilterBase.js')
const SubscriberModel = require('../../models/Subscriber.js')

class Subscriber extends FilterBase {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * ID of the feed this subscriber belongs to
     * @type {string}
     */
    this.feed = this.getField('feed')
    if (!this.feed) {
      throw new Error('feed is undefined')
    }

    /**
     * Either a role or user ID
     * @type {string}
     */
    this.id = this.getField('id')
    if (!this.id) {
      throw new Error('id is undefined')
    }

    /**
     * Either user or role
     * @type {'role'|'user'}
     */
    this.type = this.getField('type')
    if (this.type !== Subscriber.TYPES.USER && this.type !== Subscriber.TYPES.ROLE) {
      throw new Error('type must be "user" or "role"')
    }
  }

  static get TYPES () {
    return {
      USER: 'user',
      ROLE: 'role'
    }
  }

  toObject () {
    return {
      ...super.toObject(),
      feed: this.feed,
      id: this.id,
      type: this.type
    }
  }

  async validate () {
    await super.validate()
    if (this.type !== 'role' && this.type !== 'user') {
      throw new Error('type must be "user" or "role"')
    }
  }

  getMentionText () {
    if (this.type === Subscriber.TYPES.USER) {
      return `<@${this.id}>`
    } else if (this.type === Subscriber.TYPES.ROLE) {
      return `<@&${this.id}>`
    }
  }

  static get Model () {
    return SubscriberModel.Model
  }
}

module.exports = Subscriber
