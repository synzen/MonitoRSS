const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  urlPattern: {
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

schema.index({
  urlPattern: 'text'
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
