const mongoose = require('mongoose')

const schema = mongoose.Schema({
  isGuild: Boolean,
  id: {
    type: String,
    unique: true
  },
  name: String,
  date: {
    type: Date,
    default: Date.now
  }
})

exports.schema = schema
exports.model = () => mongoose.model('blacklists', schema)
