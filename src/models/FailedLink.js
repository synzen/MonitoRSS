const mongoose = require('mongoose')

const schema = mongoose.Schema({
  link: String,
  count: Number,
  failed: String
})

exports.schema = schema
exports.model = () => mongoose.model('failed_links', schema)
