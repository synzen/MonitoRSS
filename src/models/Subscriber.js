const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')
const FilterBase = require('./common/FilterBase.js')
const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))).version

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

exports.schema = schema
exports.model = mongoose.model('Subscriber', schema)
