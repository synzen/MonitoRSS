const mongoose = require('mongoose')

const schema = mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: Number,
  name: String,
  date: {
    type: Date,
    default: Date.now
  }
})

exports.schema = schema
exports.model = () => mongoose.model('blacklists', schema)
