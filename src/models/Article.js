const mongoose = require('mongoose')
const dbSettings = require('../config.js').database
const articlesExpire = dbSettings.clean === true && (dbSettings.articlesExpire > 0 || dbSettings.articlesExpire === -1) ? dbSettings.articlesExpire : 14

function expireDate () {
  return () => {
    const date = new Date()
    date.setDate(date.getDate() + articlesExpire) // Add days
    return date
  }
}

const schema = new mongoose.Schema({
  feedURL: {
    required: true,
    type: String
  },
  shardID: {
    required: true,
    type: Number
  },
  scheduleName: {
    required: true,
    type: String
  },
  id: String,
  title: String,
  date: {
    type: Date,
    default: Date.now
  },
  customComparisons: Object,
  ...articlesExpire > 0 ? { expiresAt: {
    type: Date,
    default: expireDate(),
    index: { expires: 0 }
  } } : {}
})

schema.index({
  url: 1,
  scheduleName: 1,
  shardID: 1
})

exports.schema = schema
exports.model = mongoose.model('Article', schema)
