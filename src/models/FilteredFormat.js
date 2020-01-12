const mongoose = require('mongoose')
const Format = require('./Format.js')
const FilterBase = require('./common/FilterBase.js')
const middleware = require('./middleware/Format.js')

/**
 * Override the feed key, removing the unique constraint
 */
const schema = new mongoose.Schema({
  ...Format.schema.obj,
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
