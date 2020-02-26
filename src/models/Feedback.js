const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  type: String,
  userID: String,
  username: String,
  content: String
})

schema.add(Version)

exports.schema = schema
exports.model = mongoose.model('Feedback', schema)
