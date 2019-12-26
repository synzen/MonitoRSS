const Foobar = require('./Foobar.js')
const FilterBase = require('../../../../structs/db/FilterBase.js')

class FoobarClass extends FilterBase {
  constructor (data) {
    super(data)

    this.foo = this.getField('foo')
    this.baz = this.getField('baz', 2)
    this.undefinedField = this.getField('undefinedField')
    this.object = this.getField('object')
    this.array = this.getField('array', [])
  }

  toObject () {
    return {
      ...super.toObject(),
      foo: this.foo,
      baz: this.baz,
      undefinedField: this.undefinedField,
      object: this.object,
      array: this.array
    }
  }

  static get Model () {
    return Foobar
  }
}

module.exports = FoobarClass
