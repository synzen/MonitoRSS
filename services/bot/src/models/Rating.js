const mongoose = require('mongoose')

const schema = mongoose.Schema({
  type: String,
  userId: String,
  username: String,
  rating: Number,
  date: {
    type: Date,
    default: Date.now
  }
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
