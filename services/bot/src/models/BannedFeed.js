const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  reason: String,
  guildIds: {
    type: [String],
    default: []
  }
})

schema.add(Version)

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
