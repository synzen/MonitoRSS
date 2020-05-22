const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  _id: String,
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
/** @type {import('mongoose').Model} */
exports.Model = null
