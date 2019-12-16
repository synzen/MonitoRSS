const mongoose = require('mongoose')

const schema = mongoose.Schema({
  name: {
    type: String,
    unique: true
  },
  refreshRateMinutes: Number,
  keywords: {
    type: Array,
    default: []
  },
  feedIds: {
    type: Array,
    default: []
  }
})

exports.schema = schema
exports.model = () => mongoose.model('schedules', schema)
