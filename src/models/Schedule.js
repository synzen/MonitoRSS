const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  name: {
    type: String,
    unique: true
  },
  refreshRateMinutes: Number,
  keywords: {
    type: [String],
    default: []
  },
  feeds: {
    type: [mongoose.Types.ObjectId],
    default: []
  }
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
