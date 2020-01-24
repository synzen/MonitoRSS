const mongoose = require('mongoose')
const middleware = require('./middleware/Feed.js')
const FilterBase = require('./common/FilterBase.js')
const Version = require('./common/Version.js')
const Embed = require('./common/Embed.js')

const regexOpSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  search: {
    regex: {
      type: String,
      required: true
    },
    flags: String,
    match: Number,
    group: Number
  },
  replacement: String,
  replacementDirect: String
})

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
  text: String,
  embeds: [Embed],
  disabled: String,
  checkTitles: Boolean,
  checkDates: Boolean,
  imgPreviews: Boolean,
  imgLinksExistence: Boolean,
  formatTables: Boolean,
  toggleRoleMentions: Boolean,
  regexOps: {
    type: Map,
    of: [regexOpSchema]
  }
})

schema.add(Version)
schema.add(FilterBase)

schema.pre('validate', middleware.validate)

exports.schema = schema
exports.model = mongoose.model('Feed', schema)
