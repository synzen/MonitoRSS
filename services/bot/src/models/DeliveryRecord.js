const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  articleID: {
    type: String,
    required: true
  },
  feedURL: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    required: true
  },
  delivered: {
    type: Boolean,
    required: true
  },
  comment: String
})

schema.add(Version)

schema.index({
  channel: 1
})

exports.schema = schema
/** @type {import('mongoose').Model<import('mongoose').Document, {}>} */
exports.Model = null
