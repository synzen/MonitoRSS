const mongoose = require('mongoose')
const Format = require('./Format.js')
const FilterBase = require('./common/FilterBase.js')
const middleware = require('./middleware/Format.js')

const schema = new mongoose.Schema({
  ...Format.schema.obj
})

schema.add(FilterBase)

schema.pre('validate', middleware.validate)

exports.schema = schema
exports.model = mongoose.model('FilteredFormat', schema)
