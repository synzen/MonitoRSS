const mongoose = require('mongoose')

const schema = mongoose.Schema({
  type: String,
  userID: String,
  username: String,
  content: String,
  date: {
    type: Date,
    default: Date.now
  }
})

exports.schema = schema
exports.model = mongoose.model('Feedback', schema)
