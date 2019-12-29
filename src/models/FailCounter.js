const mongoose = require('mongoose')

const schema = mongoose.Schema({
  url: String,
  count: Number,
  reason: String
})

exports.schema = schema
exports.model = () => mongoose.model('fail_counter', schema)
