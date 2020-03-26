const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  _id: {
    type: String
  },
  type: {
    type: Number,
    required: true
  },
  name: String
})

schema.add(Version)

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
