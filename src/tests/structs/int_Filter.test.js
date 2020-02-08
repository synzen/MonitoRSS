const Filter = require('../../structs/Filter.js')

describe('Int::structs/Filter', function () {
  it('returns passes correctly for broad', function () {
    const filter = new Filter('~hello world')
    const string = 'jack hello worlddunkeh'
    const string2 = 'jack hel dun'
    expect(filter.passes(string)).toEqual(true)
    expect(filter.passes(string2)).toEqual(false)
  })
  it('returns passes correctly for unmodified', function () {
    const filter = new Filter('hello world')
    const string = 'jack hello worlddunkeh'
    const string2 = 'jack hello world ha'
    expect(filter.passes(string)).toEqual(false)
    expect(filter.passes(string2)).toEqual(true)
  })
  it('returns passes correctly for inverted', function () {
    const filter = new Filter('!hello world')
    const string = 'jack hello world dunkeh'
    const string2 = 'jack hello ha'
    expect(filter.passes(string)).toEqual(false)
    expect(filter.passes(string2)).toEqual(true)
  })
  it('returns passes correctly for inverted+broad', function () {
    const filter = new Filter('!~hello world')
    const sameFilter = new Filter('~!hello world')
    const string = 'jack hello worlddunkeh'
    const string2 = 'jack hello ha'
    expect(filter.passes(string)).toEqual(false)
    expect(sameFilter.passes(string)).toEqual(false)
    expect(filter.passes(string2)).toEqual(true)
    expect(sameFilter.passes(string2)).toEqual(true)
  })
  it('does not care about case', function () {
    const filter = new Filter('HELLO WORLD')
    const string = 'hello WoRlD'
    expect(filter.passes(string)).toEqual(true)
  })
  it('does not care about case for broad', function () {
    const filter = new Filter('~world')
    const string = 'hello WoRlD'
    expect(filter.passes(string)).toEqual(true)
  })
  it('does not care about case for negated', function () {
    const filter = new Filter('!world')
    const string = 'hello WoRlD'
    expect(filter.passes(string)).toEqual(false)
  })
  it('does not care about case for broad and negated', function () {
    const filter = new Filter('!~rld')
    const filter2 = new Filter('~!rld')
    const string = 'hello WoRlD'
    expect(filter.passes(string)).toEqual(false)
    expect(filter2.passes(string)).toEqual(false)
  })
})
