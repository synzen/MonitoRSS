const Base = require('./Base.js')
const FormatModel = require('../../models/Format.js').model

class Format extends Base {
  /**
   * @param {import('mongoose').Model|Object<string, any>} data - Data
   * @param {string} data.text - Text message
   * @param {Object<string, any>[]} data.embeds - Embeds
   */
  constructor (data, _saved) {
    super(data, _saved)

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

  static isPopulatedEmbedField (field) {
    if (!field) {
      return false
    }
    const { name, value } = field
    if (!name || !value) {
      return false
    }
    return true
  }

  static isPopulatedEmbed (embed, pruneFields) {
    if (!embed) {
      return false
    }
    const keys = [
      'title',
      'description',
      'color',
      'footerText',
      'authorName',
      'thumbnailUrl',
      'imageUrl',
      'timestamp'
    ]
    let filled = false
    for (const key of keys) {
      filled = filled || !!embed[key]
    }
    const fields = embed.fields
    if (!fields || fields.length === 0) {
      return filled
    }
    for (let i = fields.length - 1; i >= 0; --i) {
      const field = fields[i]
      const populatedField = this.isPopulatedEmbedField(field)
      filled = filled || populatedField
      if (!populatedField && pruneFields === true) {
        fields.splice(i, 1)
      }
    }

    return filled
  }

  pruneEmbeds () {
    const embeds = this.embeds
    for (let i = embeds.length - 1; i >= 0; --i) {
      const populated = Format.isPopulatedEmbed(embeds[i], true)
      if (!populated) {
        embeds.splice(i, 1)
      }
    }
  }

  toObject () {
    return {
      feed: this.feed,
      text: this.text,
      embeds: this.embeds
    }
  }

  async validate () {
    this.pruneEmbeds()
    const embeds = this.embeds
    for (const embed of embeds) {
      const timestamp = embed.timestamp
      if (timestamp && timestamp !== 'article' && timestamp !== 'now') {
        throw new Error('Timestamp can only be article or now')
      }
    }
  }

  static get Model () {
    return FormatModel
  }
}

module.exports = Format
