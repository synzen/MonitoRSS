const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')
const FilterBase = require('./common/FilterBase.js')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))).version
const middleware = require('./middleware/Subscriber.js')

const schema = new mongoose.Schema({
  feed: {
    type: mongoose.Types.ObjectId,
    required: true
  },
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  version: {
    type: String,
    default: packageVersion
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
})

schema.add(FilterBase)

schema.pre('validate', middleware.validate)

exports.schema = schema
exports.model = mongoose.model('Subscriber', schema)
