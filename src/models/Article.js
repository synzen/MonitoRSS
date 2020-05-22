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
  scheduleName: 1
})

schema.index({
  feedURL: 1,
  scheduleName: 1
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
