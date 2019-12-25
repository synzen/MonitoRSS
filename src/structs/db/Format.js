const Base = require('./Base.js')
const FormatModel = require('../../models/Format.js').model

class Format extends Base {
  /**
   * @param {import('mongoose').Model|Object<string, any>} data - Data
   * @param {string} data.text - Text message
   * @param {Object<string, any>[]} data.embeds - Embeds
   */
  constructor (data) {
    super(data)

    /**
     * Feed this format belongs to
     * @type {string}
     */
    this.feed = this.getField('feed')

    /**
     * Text message
     * @type {string}
     */
    this.text = this.getField('text')

    /**
     * Embed message
     * @type {Object<string, any>[]}
     */
    this.embeds = this.getField('embeds', [])
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
