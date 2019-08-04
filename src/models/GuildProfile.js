const mongoose = require('mongoose')

const schema = mongoose.Schema({
  id: {
    type: String,
    unique: true
  },
  name: String,
  sendAlertsTo: {
    type: [String],
    default: undefined
  },
  sources: Object,
  dateFormat: String,
  dateLanguage: String,
  timezone: String,
  vip: Object,
  prefix: String,
  locale: String,
  version: String
})

exports.schema = schema
exports.model = () => mongoose.model('guilds', schema)
