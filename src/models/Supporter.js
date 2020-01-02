const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  _id: String,
  patron: Boolean,
  webhook: Boolean,
  maxGuilds: Number,
  maxFeeds: Number,
  guilds: [String],
  expireAt: Date,
  comment: String,
  slowRate: Boolean
})

exports.schema = schema
exports.model = mongoose.model('Supporter', schema)
