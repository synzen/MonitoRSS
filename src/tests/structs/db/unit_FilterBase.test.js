process.env.TEST_ENV = true
const FilterBase = require('../../../structs/db/FilterBase.js')

jest.mock('../../../config.js')

class FilterClass extends FilterBase {
  static get Model () {

  }
}

class FilterClassWithFoo extends FilterBase {
  constructor (data, _saved) {
    super(data, _saved)
    this.foo = this.getField('foo')
  }

  toObject () {
    return {
      foo: this.foo
    }
  }

  static get Model () {

  }
}

describe('Unit::structs/db/FilterBase', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('initializes correctly', function () {
      const base = new FilterClass()
      expect(base.filters).toEqual({})
      expect(base.rfilters).toEqual({})
    })
  })
  describe('toObject', function () {
    it('converts the filters into a map', function () {
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
    it('converts rfilters into a map', function () {
      const base = new FilterClass()
      const rfilters = {
        title: 'swrhyetg',
        dasdge: '46treht5ru'
      }
      base.rfilters = rfilters
      const returned = base.toObject()
      expect(returned.rfilters).toBeInstanceOf(Map)
      for (const key in rfilters) {
        expect(returned.rfilters.get(key)).toEqual(rfilters[key])
      }
    })
  })
  describe('toJSON', function () {
    it('returns plain object', function () {
      const filters = {
        a: ['fdg'],
        b: [1, 2, 6]
      }
      const rfilters = {
        a: 'qewts',
        c: 'asedgrfh',
        d: 'wse4yr5'
      }
      const base = new FilterClassWithFoo()
      base.filters = filters
      base.rfilters = rfilters
      base.foo = 'helloa world'
      const returned = base.toJSON()
      expect(returned).toEqual({
        foo: base.foo,
        filters,
        rfilters
      })
      expect(returned.filters).not.toBeInstanceOf(Map)
      // expect(returned.filters).toEqual(filters)
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
  describe('getFilterIndex', function () {
    it('works', function () {
      const filters = {
        skadoosh: ['a', 'b', 'c', 'd'],
        honk: ['z', 'g', 'e']
      }
      const base = new FilterClass()
      base.filters = filters
      expect(base.getFilterIndex('skadoosh', 'c')).toEqual(2)
      expect(base.getFilterIndex('skadoosh', 'B')).toEqual(1)
      expect(base.getFilterIndex('skadoosh', 'h')).toEqual(-1)
    })
  })
  describe('removeFilter', function () {
    beforeEach(function () {
      jest.spyOn(FilterClass.prototype, 'save').mockReturnValue()
    })
    it('throws an error if it does not exist', function () {
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(-1)
      const base = new FilterClass()
      return expect(base.removeFilter('', 'abc'))
        .rejects.toThrowError(new Error('"abc" does not exist'))
    })
    it('splices the value if it exists', async function () {
      const filters = {
        foo: ['a', 'g', 'facts']
      }
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(1)
      const base = new FilterClass()
      base.filters = filters
      await base.removeFilter('foo', '')
      expect(base.filters).toEqual({
        foo: ['a', 'facts']
      })
    })
    it('calls this.save', async function () {
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(0)
      const base = new FilterClass()
      const spy = jest.spyOn(base, 'save')
      base.filters = {
        foo: ['abc']
      }
      await base.removeFilter('foo', 'abc')
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
  describe('addFilter', function () {
    beforeEach(function () {
      jest.spyOn(FilterClass.prototype, 'save').mockReturnValue()
    })
    it('throws an error if it exists', function () {
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(1)
      const base = new FilterClass()
      return expect(base.addFilter('', 'abc'))
        .rejects.toThrowError(new Error('"abc" already exists'))
    })
    it('adds the value', async function () {
      const filters = {
        foo: ['a']
      }
      const toAdd = 'ju'
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(-1)
      const base = new FilterClass()
      base.filters = filters
      await base.addFilter('foo', toAdd)
      await base.addFilter('fad', toAdd)
      expect(base.filters).toEqual({
        foo: ['a', toAdd],
        fad: [toAdd]
      })
    })
    it('lowercase and trims the added value', async function () {
      const filters = {
        foo: ['a']
      }
      const toAdd = ' JA '
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(-1)
      const base = new FilterClass()
      base.filters = filters
      await base.addFilter('foo', toAdd)
      expect(base.filters).toEqual({
        foo: ['a', toAdd.toLowerCase().trim()]
      })
    })
    it('calls this.save', async function () {
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(-1)
      const base = new FilterClass()
      const spy = jest.spyOn(base, 'save')
      base.filters = {
        foo: ['abc']
      }
      await base.addFilter('foo', 'abc')
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
  describe('addFilters', function () {
    beforeEach(function () {
      jest.spyOn(FilterClass.prototype, 'save').mockReturnValue()
    })
    it('throws an error if a filter already exists', function () {
      jest.spyOn(FilterClass.prototype, 'getFilterIndex')
        .mockReturnValueOnce(-1)
        .mockReturnValue(1)
      const base = new FilterClass()
      base.filters = {
        h: ['da', 'abc']
      }
      return expect(base.addFilters('h', ['zzz', 'asdf']))
        .rejects.toThrowError(new Error('"asdf" already exists'))
    })
    it('adds the values', async function () {
      const filters = {
        foo: ['a']
      }
      const toAdd = ['fun', 'two', 'ne', 'zz']
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(-1)
      const base = new FilterClass()
      base.filters = filters
      await base.addFilters('foo', toAdd)
      await base.addFilters('bar', toAdd)
      expect(base.filters).toEqual({
        foo: ['a'].concat(toAdd),
        bar: toAdd
      })
    })
    it('lowercase and trims the added values', async function () {
      const filters = {
        foo: ['a']
      }
      const toAdd = [' JA ', '43W E']
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(-1)
      const base = new FilterClass()
      base.filters = filters
      await base.addFilters('foo', toAdd)
      expect(base.filters).toEqual({
        foo: ['a'].concat(toAdd.map(s => s.trim().toLowerCase()))
      })
    })
    it('calls this.save', async function () {
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(-1)
      const base = new FilterClass()
      const spy = jest.spyOn(base, 'save')
      base.filters = {
        foo: ['abc']
      }
      await base.addFilters('foo', [])
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
  describe('removeFilters', function () {
    beforeEach(function () {
      jest.spyOn(FilterClass.prototype, 'save').mockReturnValue()
    })
    it('removes the values', async function () {
      const filters = {
        foo: ['a', 'ae', 'wsr', 'swrg']
      }
      jest.spyOn(FilterClass.prototype, 'getFilterIndex')
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(1)
      const base = new FilterClass()
      base.filters = filters
      await base.removeFilters('foo', ['a', 'b'])
      expect(base.filters).toEqual({
        foo: ['a', 'swrg']
      })
    })
    it('calls this.save if removed', async function () {
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(0)
      const base = new FilterClass()
      const spy = jest.spyOn(base, 'save')
      base.filters = {
        foo: ['abc']
      }
      await base.removeFilters('foo', ['a'])
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('does not call this.save if not removed', async function () {
      jest.spyOn(FilterClass.prototype, 'getFilterIndex').mockReturnValue(-1)
      const base = new FilterClass()
      const spy = jest.spyOn(base, 'save')
      base.filters = {
        foo: ['abc']
      }
      await base.removeFilters('foo', ['a'])
      expect(spy).not.toHaveBeenCalled()
    })
    it('removes the values if indexes are not in order', async function () {
      const filters = {
        foo: ['a', 'ae', 'wsr', 'swrg']
      }
      jest.spyOn(FilterClass.prototype, 'getFilterIndex')
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2)
      const base = new FilterClass()
      base.filters = filters
      await base.removeFilters('foo', ['a', 'b'])
      expect(base.filters).toEqual({
        foo: ['a', 'swrg']
      })
    })
  })
  describe('removeAllFilters', function () {
    beforeEach(function () {
      jest.spyOn(FilterClass.prototype, 'save').mockReturnValue()
    })
    it('sets this.filters to an empty object', async function () {
      const base = new FilterClass()
      base.filters = {
        foo: 'bar',
        jack: 1
      }
      await base.removeAllFilters()
      expect(base.filters).toEqual({})
    })
    it('calls this.save', async function () {
      const base = new FilterClass()
      const spy = jest.spyOn(base, 'save')
      await base.removeAllFilters()
      expect(spy).toHaveBeenCalled()
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
  describe('hasFilters', function () {
    it('returns correctly', function () {
      const base = new FilterClass()
      base.filters = {}
      expect(base.hasFilters()).toEqual(false)
      base.filters = {
        title: ['ha']
      }
      expect(base.hasFilters()).toEqual(true)
    })
  })
  describe('hasRFilters', function () {
    it('returns correctly', function () {
      const base = new FilterClass()
      base.rfilters = {}
      expect(base.hasRFilters()).toEqual(false)
      base.rfilters = {
        title: 'halo'
      }
      expect(base.hasRFilters()).toEqual(true)
    })
  })
})
