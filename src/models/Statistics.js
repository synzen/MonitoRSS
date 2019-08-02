const mongoose = require('mongoose')

const schema = mongoose.Schema({
  guilds: Number,
  feeds: Number,
  cycleTime: Number,
  cycleFails: Number,
  cycleLinks: Number,
  shard: {
    type: Number,
    unique: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
})

exports.schema = schema
exports.model = () => mongoose.model('statistics', schema)
