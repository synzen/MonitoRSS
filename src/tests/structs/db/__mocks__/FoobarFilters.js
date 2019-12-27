const mongoose = require('mongoose')
const FilterBase = require('../../../../models/common/FilterBase.js')

const FoobarSchema = new mongoose.Schema({
  foo: String
})

FoobarSchema.add(FilterBase)

const Foobar = mongoose.model('FoobarFilters', FoobarSchema)

module.exports = Foobar
