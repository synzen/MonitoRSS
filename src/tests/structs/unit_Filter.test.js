const Filter = require('../../structs/Filter.js')

describe('Unit::structs/Filter', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('lowercases content', function () {
      const broad = new Filter('HELO')
      expect(broad.content).toEqual('helo')
    })
  })
  describe('static escapeRegex', function () {
    it('returns a string', function () {
      expect(typeof Filter.escapeRegex('hellozz'))
        .toEqual('string')
    })
  })
  describe('get broad', function () {
    it('returns correctly', function () {
      const broad = new Filter('')
      broad.content = '~heloa'
      const notBroad = new Filter('')
      notBroad.content = 'heloa'
      expect(broad.broad).toEqual(true)
      expect(notBroad.broad).toEqual(false)
    })
    it('returns combined modifiers correctly', function () {
      const filter = new Filter('')
      filter.content = '!~heloa'
      expect(filter.broad).toEqual(true)
      filter.content = '~!heloa'
      expect(filter.broad).toEqual(true)
    })
  })
  describe('get inverted', function () {
    it('returns correctly', function () {
      const inverted = new Filter('')
      inverted.content = '!heloa'
      const notInverted = new Filter('')
      notInverted.content = 'heloa'
      expect(inverted.inverted).toEqual(true)
      expect(notInverted.inverted).toEqual(false)
    })
    it('returns combined modifiers correctly', function () {
      const filter = new Filter('')
      filter.content = '!~heloa'
      expect(filter.inverted).toEqual(true)
      filter.content = '~!heloa'
      expect(filter.inverted).toEqual(true)
    })
  })
  describe('parseWord', function () {
    it('removes broad modifier', function () {
      const filter = new Filter('')
      filter.content = '~hallo'
      expect(filter.parseWord()).toEqual('hallo')
    })
    it('removes inverter modifier', function () {
      const filter = new Filter('')
      filter.content = '!hallo'
      expect(filter.parseWord()).toEqual('hallo')
    })
    it('removes combined modifiers', function () {
      const filter = new Filter('')
      filter.content = '~!hallo'
      expect(filter.parseWord()).toEqual('hallo')
      filter.content = '!~hallo'
      expect(filter.parseWord()).toEqual('hallo')
    })
    it('removes forward slash escape for broad modifier', function () {
      const filter = new Filter('')
      filter.content = '\\~hallo'
      expect(filter.parseWord()).toEqual('~hallo')
    })
    it('removes forward slash escape for inverter modifier', function () {
      const filter = new Filter('')
      filter.content = '\\!hallo'
      expect(filter.parseWord()).toEqual('!hallo')
    })
  })
  describe('foundIn', function () {
    it('returns whether the search term is included, irrespective of space if broad', function () {
      const filter = new Filter('')
      jest.spyOn(filter, 'broad', 'get').mockReturnValue(true)
      filter.searchTerm = 'foobar'
      expect(filter.foundIn('asdsgfoobaradfsgl')).toEqual(true)
    })
    it('returns whether the search term is included, with respect to space if not broad', function () {
      const filter = new Filter('')
      jest.spyOn(filter, 'broad', 'get').mockReturnValue(false)
      filter.searchTerm = 'foobar'
      jest.spyOn(Filter, 'escapeRegex').mockReturnValue(filter.searchTerm)
      expect(filter.foundIn('asdsgfoobaradfsgl')).toEqual(false)
      expect(filter.foundIn('foh foobar faz')).toEqual(true)
    })
    it('does not care about case for broad', function () {
      const filter = new Filter('')
      jest.spyOn(filter, 'broad', 'get').mockReturnValue(true)
      filter.searchTerm = 'foobar'
      expect(filter.foundIn('Foobar')).toEqual(true)
    })
    it('does not care about case for non-broad', function () {
      const filter = new Filter('')
      jest.spyOn(filter, 'broad', 'get').mockReturnValue(false)
      filter.searchTerm = 'foobar'
      jest.spyOn(Filter, 'escapeRegex').mockReturnValue(filter.searchTerm)
      expect(filter.foundIn('Foobar')).toEqual(true)
    })
  })
  describe('passes', function () {
    it('returns not found if inverted', function () {
      const filter = new Filter('')
      jest.spyOn(filter, 'inverted', 'get').mockReturnValue(true)
      jest.spyOn(filter, 'foundIn').mockReturnValue(true)
      expect(filter.passes()).toEqual(false)
      jest.spyOn(filter, 'foundIn').mockReturnValue(false)
      expect(filter.passes()).toEqual(true)
    })
    it('returns found if not inverted', function () {
      const filter = new Filter('')
      jest.spyOn(filter, 'inverted', 'get').mockReturnValue(false)
      jest.spyOn(filter, 'foundIn').mockReturnValue(true)
      expect(filter.passes()).toEqual(true)
      jest.spyOn(filter, 'foundIn').mockReturnValue(false)
      expect(filter.passes()).toEqual(false)
    })
  })
})
