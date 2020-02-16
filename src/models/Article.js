const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  feedURL: {
    required: true,
    type: String
  },
  shardID: {
    required: true,
    type: Number
  },
  scheduleName: {
    required: true,
    type: String
  },
  date: {
    type: Date,
    default: Date.now
  },
  properties: {
    type: Map,
    of: String
  }
})

schema.add(Version)

schema.index({
  url: 1,
  scheduleName: 1,
  shardID: 1
})

exports.schema = schema
exports.model = mongoose.model('Article', schema)
