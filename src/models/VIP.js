const mongoose = require('mongoose')

const schema = mongoose.Schema({
  id: {
    type: String,
    unique: true
  },
  invalid: Boolean,
  name: String,
  fname: String,
  servers: {
    type: [String],
    default: []
  },
  permanent: Boolean,
  pledged: Number,
  totalPledged: Number,
  maxFeeds: Number,
  maxServers: Number,
  allowWebhooks: Boolean,
  allowCookies: Boolean,
  expireAt: {
    type: Date,
    index: { expires: 0 }
  },
  gracedUntil: {
    type: Date,
    index: { expires: 0 }
  },
  override: Boolean,
  comment: String
})

exports.schema = schema
exports.model = () => mongoose.model('vips', schema)
