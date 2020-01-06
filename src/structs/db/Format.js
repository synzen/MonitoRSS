const FilteredFormat = require('./FilteredFormat.js')
const FormatModel = require('../../models/Format.js').model

class Format extends FilteredFormat {
  constructor (data, _saved) {
    super(data, _saved)

    /**
     * Do *not* save filters on this model - there should only be
     * one Format per feed
     * @type {undefined}
     */
    this.filters = undefined

    /**
     * Do *not* save priority on this model - there should only be
     * one Format per feed
     * @type {undefined}
     */
    this.priority = undefined
  }

  toObject () {
    return {
      feed: this.feed,
      text: this.text,
      embeds: this.embeds
    }
  }

  static get Model () {
    return FormatModel
  }
}

module.exports = Format
