const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))).version

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  alert: {
    type: [String]
  },
  sources: Object,
  dateFormat: String,
  dateLanguage: String,
  timezone: String,
  prefix: String,
  locale: String,
  version: {
    type: String,
    default: packageVersion
  }
})

exports.schema = schema
exports.model = mongoose.model('Guild', schema)
