const mongoose = require('mongoose')
const FilterBase = require('./common/FilterBase.js')
const Embed = require('./common/Embed.js')
const middleware = require('./middleware/FilteredFormat.js')

/**
 * Override the feed key, removing the unique constraint
 */
const schema = new mongoose.Schema({
  text: String,
  embeds: [Embed],
  feed: {
    type: mongoose.Types.ObjectId,
    required: true
  },
  priority: Number
})

schema.add(FilterBase)

schema.pre('validate', middleware.validate)

exports.schema = schema
exports.model = mongoose.model('Filtered_Format', schema)
