const FilterBase = require('../../../structs/db/FilterBase.js')
const Base = require('../../../structs/db/Base.js')

class FilterClass extends FilterBase {
  static get Model () {

  }
}

describe('Unit::structs/db/FilterBase', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('toObject', function () {
    it('converts the filters into a map for database', function () {
      jest.spyOn(Base, 'isMongoDatabase', 'get').mockReturnValue(true)
      const base = new FilterClass()
      const filters = {
        title: ['ab', 'gf'],
        dasdge: [1, 2, 3]
      }
      base.filters = filters
      const returned = base.toObject()
      expect(returned.filters).toBeInstanceOf(Map)
      for (const key in filters) {
        expect(returned.filters.get(key)).toEqual(filters[key])
      }
    })
    it('returns plain object for databaseless', function () {
      jest.spyOn(Base, 'isMongoDatabase', 'get').mockReturnValue(false)
      const filters = {
        a: ['fdg'],
        b: [1, 2, 6]
      }
      const base = new FilterClass()
      base.filters = filters
      const returned = base.toObject()
      expect(returned.filters).not.toBeInstanceOf(Map)
      expect(returned.filters).toEqual(filters)
    })
  })
  describe('pruneFilters', function () {
    it('deletes invalid filters', function () {
      const filters = {
        a: [],
        b: 0,
        good: ['a', 'bc', 'de'],
        c: null,
        d: undefined,
        e: '3',
        f: 1
      }
      const base = new FilterClass()
      base.filters = { ...filters }
      base.pruneFilters()
      const keys = Object.keys(base.filters)
      expect(keys).toHaveLength(1)
      expect(base.filters.good).toEqual(filters.good)
    })
  })
  describe('validate', function () {
    it('calls pruneFilters', function () {
      const base = new FilterClass()
      const spy = jest.spyOn(base, 'pruneFilters').mockReturnValue()
      base.validate()
      expect(spy).toHaveBeenCalled()
    })
  })
})
