const URL = require('url').URL
const mongoose = require('mongoose')
const dbSettings = require('../config.js').database
const articlesExpire = dbSettings.clean === true && (dbSettings.articlesExpire > 0 || dbSettings.articlesExpire === -1) ? dbSettings.articlesExpire : 14

function hash (str) {
  // https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
  let hash = 0
  if (str.length === 0) return hash
  for (var i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

function getCollectionID (link, shardId, scheduleName = '') {
  if (shardId == null || isNaN(shardId)) {
    throw new Error('shardId must be a number')
  }
  if (!scheduleName || scheduleName === 'default') {
    scheduleName = ''
  }
  let res = `${shardId}_` + scheduleName.slice(0, 10) + hash(link).toString() + (new URL(link)).hostname.replace(/\.|\$/g, '')
  const len = mongoose.connection.name ? (res.length + mongoose.connection.name.length + 1) : res.length + 1 // mongoose.connection.name is undefined if config.database.uri is a databaseless folder path
  if (len > 115) res = res.slice(0, 115)
  return res
}

function expireDate () {
  return () => {
    const date = new Date()
    date.setDate(date.getDate() + articlesExpire) // Add days
    return date
  }
}

const schema = mongoose.Schema({
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

exports.schema = schema
exports.model = (link, shardId, scheduleName) => mongoose.model(getCollectionID(link, shardId, scheduleName), schema, getCollectionID(link, shardId, scheduleName)) // Third parameter is not let mongoose auto-pluralize the collection name
exports.modelByID = collectionID => mongoose.model(collectionID, schema, collectionID) // Third parameter is not let mongoose auto-pluralize the collection name
exports.getCollectionID = getCollectionID
