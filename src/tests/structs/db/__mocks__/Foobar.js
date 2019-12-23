const mongoose = require('mongoose')

const FoobarSchema = new mongoose.Schema({
  foo: String,
  baz: Number
})

const Foobar = mongoose.model('Foobar', FoobarSchema)

module.exports = Foobar
