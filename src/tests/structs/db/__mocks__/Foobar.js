const mongoose = require('mongoose')

const FoobarSchema = new mongoose.Schema({
  foo: String,
  baz: Number,
  undefinedField: String,
  array: [String],
  object: {
    key: String
  },
  objectId: mongoose.Types.ObjectId
})

const Foobar = mongoose.model('Foobar', FoobarSchema)

module.exports = Foobar
