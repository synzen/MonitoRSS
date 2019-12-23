const mongoose = require('mongoose')
const middleware = require('./middleware/GuildProfile.js')
const path = require('path')
const fs = require('fs')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))).version

const schema = new mongoose.Schema({
  _id: String,
  name: String,
  sendAlertsTo: {
    type: [String],
    default: undefined
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
  },
  feeds: [{
    type: mongoose.Types.ObjectId,
    ref: 'Feed'
  }]
})

schema.pre('findOneAndUpdate', middleware.findOneAndUpdate)
schema.pre('remove', middleware.remove)

exports.schema = schema
exports.model = mongoose.model('Guild', schema)
