const mongoose = require('mongoose')
const middleware = require('./middleware/FilterBase.js')

const schema = new mongoose.Schema({
  filters: {
    type: Map,
    of: [String]
  }
})

schema.pre('validate', middleware.checkEmptyFilters)

exports.schema = schema
exports.model = mongoose.model('FilterBase', schema)
