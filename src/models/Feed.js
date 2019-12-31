const mongoose = require('mongoose')
const middleware = require('./middleware/Feed.js')
const FilterBase = require('./common/FilterBase.js')
const Version = require('./common/Version.js')

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
    type: String,
    required: true
  },
  channel: {
    type: String,
    required: true
  },
  webhook: {
    id: String,
    name: String,
    avatar: String
  },
  split: {
    enabled: Boolean,
    char: String,
    prepend: String,
    append: String,
    maxLength: Number
  },
  disabled: String,
  checkTitles: Boolean,
  checkDates: Boolean,
  imgPreviews: Boolean,
  imgLinksExistence: Boolean,
  formatTables: Boolean,
  toggleRoleMentions: Boolean
})

schema.add(Version)
schema.add(FilterBase)

schema.pre('validate', middleware.validate)

exports.schema = schema
exports.model = mongoose.model('Feed', schema)
