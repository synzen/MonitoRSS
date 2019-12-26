const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  filters: {
    type: Map,
    of: [String]
  }
})

exports.schema = schema
exports.model = mongoose.model('FilterBase', schema)
