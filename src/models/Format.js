const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const fieldSchema = new mongoose.Schema({
  name: String,
  value: String,
  inline: Boolean
})

const embedSchema = new mongoose.Schema({
  title: String,
  description: String,
  url: String,
  color: Number,
  footerText: String,
  authorName: String,
  authorIconUrl: String,
  authorUrl: String,
  thumbnailUrl: String,
  imageUrl: String,
  timestamp: String,
  fields: [fieldSchema]
})

const schema = new mongoose.Schema({
  feed: mongoose.Types.ObjectId,
  text: String,
  embeds: [embedSchema]
})

schema.add(Version)

exports.schema = schema
exports.model = mongoose.model('Format', schema)
