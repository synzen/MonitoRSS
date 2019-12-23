const Foobar = require('./Foobar.js')
const Base = require('../../../../structs/db/Base.js')

class FoobarClass extends Base {
  constructor (data) {
    super(data)

    this.foo = this.getField('foo')
    this.baz = this.getField('baz', 2)
  }

  toObject () {
    return {
      foo: this.foo,
      baz: this.baz
    }
  }

  static get Model () {
    return Foobar
  }
}

module.exports = FoobarClass
