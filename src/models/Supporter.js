const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  _id: String,
  patron: Boolean,
  webhook: Boolean,
  maxSevers: Number,
  maxFeeds: Number,
  servers: [String],
  expireAt: Date,
  comment: String,
  slowRate: Boolean
})

exports.schema = schema
exports.model = mongoose.model('Supporter', schema)
