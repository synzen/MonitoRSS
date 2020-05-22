const FoobarFilters = require('./FoobarFilters.js')
const FilterBase = require('../../../../structs/db/FilterBase.js')

class FoobarClass extends FilterBase {
  constructor (data, _saved) {
    super(data, _saved)

    this.foo = this.getField('foo')
  }

  toObject () {
    return {
      ...super.toObject(),
      foo: this.foo
    }
  }

  static get Model () {
    return FoobarFilters
  }
}

module.exports = FoobarClass
