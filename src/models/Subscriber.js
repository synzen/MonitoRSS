const mongoose = require('mongoose')
const FilterBase = require('./common/FilterBase.js')
const Version = require('./common/Version.js')
const middleware = require('./middleware/Subscriber.js')

const schema = new mongoose.Schema({
  feed: {
    type: mongoose.Types.ObjectId,
    required: true
  },
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  }
})

schema.add(Version)
schema.add(FilterBase)

schema.pre('validate', middleware.validate)

exports.schema = schema
exports.model = mongoose.model('Subscriber', schema)
