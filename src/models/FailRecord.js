const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  url: {
    type: String,
    unique: true
  },
  reason: String,
  failedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  alerted: {
    type: Boolean,
    default: false
  }
})

schema.add(Version)

exports.schema = schema
exports.model = mongoose.model('fail_record', schema)
