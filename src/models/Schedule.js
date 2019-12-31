const mongoose = require('mongoose')
const Version = require('./common/Version.js')

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

schema.add(Version)

exports.schema = schema
exports.model = mongoose.model('schedules', schema)
