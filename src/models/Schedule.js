const mongoose = require('mongoose')

const schema = mongoose.Schema({
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
exports.model = mongoose.model('schedules', schema)
