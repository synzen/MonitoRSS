const mongoose = require('mongoose')

const schema = mongoose.Schema({
  name: {
    type: String,
    unique: true
  },
  refreshRateMinutes: Number
})

exports.schema = schema
exports.model = () => mongoose.model('schedules', schema)
