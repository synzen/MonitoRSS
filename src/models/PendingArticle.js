const mongoose = require('mongoose')
const Version = require('./common/Version.js')

const schema = new mongoose.Schema({
  article: mongoose.Schema.Types.Mixed
}, {
  // Maintain the original structure of the article
  minimize: false
})

schema.add(Version)

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
