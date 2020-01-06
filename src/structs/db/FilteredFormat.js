const FilterBase = require('./FilterBase.js')
const FilteredFormatModel = require('../../models/FilteredFormat.js').model

class Format extends FilterBase {
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
    if (!this.feed) {
      throw new Error('feed is undefined')
    }

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

    /**
     * Filters for formats
     * @type {Object<string, string[]>}
     */
    this.filters = this.getField('filters')

    /**
     * Optional priority to decide which filtered format to use if
     * multiple are matched
     */
    this.priority = this.getField('priority')
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
      const populated = this.constructor.isPopulatedEmbed(embeds[i], true)
      if (!populated) {
        embeds.splice(i, 1)
      }
    }
  }

  toObject () {
    return {
      ...super.toObject(),
      feed: this.feed,
      text: this.text,
      embeds: this.embeds,
      priority: this.priority
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
    return FilteredFormatModel
  }
}

module.exports = Format
