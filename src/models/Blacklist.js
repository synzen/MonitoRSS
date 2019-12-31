const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: Number,
    required: true
  },
  name: String
})

schema.add(Version)

exports.schema = schema
exports.model = mongoose.model('Blacklist', schema)
