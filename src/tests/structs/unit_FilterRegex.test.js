const FilterRegex = require('../../structs/FilterRegex.js')

describe('Unit::structs/FilterRegex', function () {
  describe('passes', function () {
    it('returns correctly', function () {
      const filter = new FilterRegex('jo.*ey')
      expect(filter.passes('jodfgey')).toEqual(true)
      expect(filter.passes('zzzz')).toEqual(false)
    })
    it('does not care about case', function () {
      const filter = new FilterRegex('jo*ey')
      expect(filter.passes('JOEY')).toEqual(true)
    })
  })
})
