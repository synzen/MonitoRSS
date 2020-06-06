const KeyValueModel = require('../../models/KeyValue.js')
const Base = require('./Base.js')

class KeyValue extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    if (!this._id) {
      throw new TypeError('_id is undefined')
    }

    /**
     * Value
     * @type {any}
     */
    this.value = this.getField('value')
    if (this.value === undefined) {
      throw new TypeError('value is undefined')
    }
  }

  static get keys () {
    return {
      FEED_CONFIG: 'feedConfig',
      SUPPORTER_CONFIG: 'supporterConfig'
    }
  }

  toObject () {
    return {
      _id: this._id,
      value: this.value
    }
  }

  static get Model () {
    return KeyValueModel.Model
  }
}

module.exports = KeyValue
