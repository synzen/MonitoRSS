const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  data: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 10 // 10 minutes
  }
})

const model = mongoose.model('Web Cache', schema)

exports.schema = schema
exports.model = model
