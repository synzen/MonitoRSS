const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  url: {
    type: String,
    unique: true
  },
  count: Number,
  reason: String
})

schema.add(Version)

exports.schema = schema
exports.model = mongoose.model('fail_counter', schema)
