const mongoose = require('mongoose')

const schema = mongoose.Schema({
  url: {
    type: String,
    unique: true
  },
  count: Number,
  reason: String
})

exports.schema = schema
exports.model = mongoose.model('fail_counter', schema)
