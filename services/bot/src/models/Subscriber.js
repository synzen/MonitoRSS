const mongoose = require('mongoose')
const FilterBase = require('./common/FilterBase.js')
const Version = require('./common/Version.js')
const subscriberMiddleware = require('./middleware/Subscriber.js')

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

schema.index({
  feed: 1
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
exports.setupHooks = (connection) => {
  schema.pre('validate', subscriberMiddleware.validate(connection))
}
