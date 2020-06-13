const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  articleID: {
    type: mongoose.Types.ObjectId,
    required: true
  },
  channel: {
    type: String,
    required: true
  },
  failed: String
})

schema.add(Version)

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
