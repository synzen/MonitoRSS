const mongoose = require('mongoose')
const FilterBase = require('./common/FilterBase.js')
const Embed = require('./common/Embed.js')
const Version = require('./common/Version.js')
const filteredFormatMiddleware = require('./middleware/FilteredFormat.js')

/**
 * Override the feed key, removing the unique constraint
 */
const schema = new mongoose.Schema({
  text: {
    type: String,
    default: undefined
  },
  embeds: {
    type: [Embed],
    default: undefined
  },
  feed: {
    type: mongoose.Types.ObjectId,
    required: true
  },
  priority: Number
})

schema.add(Version)
schema.add(FilterBase)

schema.index({
  feed: 1
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
exports.setupHooks = (connection) => {
  schema.pre('validate', filteredFormatMiddleware.validate(connection))
}
