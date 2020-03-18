const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  _id: String,
  data: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 10 // 10 minutes
  }
})

const model = mongoose.model('Web User', schema)

exports.schema = schema
exports.model = model
