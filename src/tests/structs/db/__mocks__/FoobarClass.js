const Foobar = require('./Foobar.js')
const Base = require('../../../../structs/db/Base.js')

class FoobarClass extends Base {
  constructor (data, _saved) {
    super(data, _saved)

    this.foo = this.getField('foo')
    this.baz = this.getField('baz', 2)
    this.undefinedField = this.getField('undefinedField')
    this.object = this.getField('object')
    this.array = this.getField('array', [])
  }

  toObject () {
    return {
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
