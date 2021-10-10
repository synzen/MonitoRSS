const mongoose = require('mongoose')
const feedMiddleware = require('./middleware/Feed.js')
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
  fallbackValue: String,
  replacement: String,
  replacementDirect: String
})

const schema = new mongoose.Schema({
  articleMaxAge: {
    type: Number,
    required: false,
    min: 1
  },
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
    avatar: String,
    disabled: Boolean,
    url: String
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
  directSubscribers: Boolean,
  ncomparisons: [String],
  pcomparisons: [String],
  regexOps: {
    type: Map,
    of: [regexOpSchema]
  }
})

schema.add(Version)
schema.add(FilterBase)

schema.index({
  guild: 1
})

schema.index({
  url: 1
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
exports.setupHooks = (connection) => {
  schema.pre('validate', feedMiddleware.validate(connection))
}
