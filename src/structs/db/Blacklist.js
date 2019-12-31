const BlacklistModel = require('../../models/Blacklist.js').model
const Base = require('./Base.js')

class Blacklist extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * ID
     * @type {string}
     */
    this.id = this.getField('id')
    if (!this.id) {
      throw new TypeError('id is undefined')
    }

    /**
     * Type of blacklist. 0 for user, 1 for guild
     * @type {number}
     */
    this.type = this.getField('type')
    if (this.type === undefined) {
      throw new TypeError('type is undefined')
    }
    if (isNaN(this.type)) {
      throw new TypeError('type is not a number')
    }

    /**
     * Optional name of the target
     * @type {string}
     */
    this.name = this.getField('name')
  }

  static get TYPES () {
    return {
      USER: 0,
      GUILD: 1
    }
  }

  toObject () {
    return {
      id: this.id,
      type: this.type,
      name: this.name
    }
  }

  static get Model () {
    return BlacklistModel
  }
}

module.exports = Blacklist
