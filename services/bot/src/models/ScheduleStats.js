const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  _id: String,
  feeds: Number,
  cycleTime: Number,
  cycleFails: Number,
  cycleURLs: Number,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
