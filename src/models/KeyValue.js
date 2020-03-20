const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  _id: String,
  value: mongoose.Schema.Types.Mixed
})

schema.add(Version)

exports.schema = schema
exports.model = mongoose.model('key_values', schema)
