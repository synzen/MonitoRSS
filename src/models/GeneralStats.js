const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  data: mongoose.Schema.Types.Mixed
})

exports.schema = schema
/** @type {import('mongoose').Model} */
exports.Model = null
exports.TYPES = {
  ARTICLES_SENT: 'articlesSent',
  ARTICLES_BLOCKED: 'articlesBlocked'
}
