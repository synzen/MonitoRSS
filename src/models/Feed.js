const mongoose = require('mongoose')
const middleware = require('./middleware/Feed.js')
const path = require('path')
const fs = require('fs')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))).version

const schema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  guild: {
    type: mongoose.Types.ObjectId,
    required: true
  },
  channel: {
    type: String,
    required: true
  },
  checkTitles: Boolean,
  checkDates: Boolean,
  imgPreviews: Boolean,
  imgLinksExistence: Boolean,
  formatTables: Boolean,
  toggleRoleMentions: Boolean,
  version: {
    type: String,
    default: packageVersion
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
})

schema.pre('findOneAndUpdate', middleware.findOneAndUpdate)
schema.pre('remove', middleware.remove)
schema.pre('save', middleware.save)

exports.schema = schema
exports.model = mongoose.model('Feed', schema)
