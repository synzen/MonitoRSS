process.env.TEST_ENV = true
const Blacklist = require('../../../structs/db/Blacklist.js')

jest.mock('../../../config.js')

describe('Unit::structs/db/Blacklist', function () {
  describe('constructor', function () {
    it('throws for undefined id', function () {
      const data = {
        type: 123,
        name: 'gfh'
      }
      expect(() => new Blacklist(data))
        .toThrow(new TypeError('_id is undefined'))
    })
    it('throws for undefined type', function () {
      const data = {
        _id: 'asd',
        name: 'gfh'
      }
      expect(() => new Blacklist(data))
        .toThrow(new TypeError('type is undefined'))
    })
    it('throws for NaN type', function () {
      const data = {
        _id: 'asd',
        name: 'gfh',
        type: 'he'
      }
      expect(() => new Blacklist(data))
        .toThrow(new TypeError('type is not a number'))
    })
    it('does not throw for missing name', function () {
      const data = {
        _id: 'asd',
        type: 2
      }
      expect(() => new Blacklist(data))
        .not.toThrow()
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const data = {
        _id: 'srfh',
        name: '3e45y',
        type: 5
      }
      const blacklist = new Blacklist({ ...data })
      const returned = blacklist.toObject()
      expect(returned).toEqual(data)
    })
  })
  describe('static get TYPES', function () {
    it('returns correctly', function () {
      expect(Blacklist.TYPES.GUILD).toEqual(1)
      expect(Blacklist.TYPES.USER).toEqual(0)
    })
  })
  describe('get id', function () {
    it('gets the _id', function () {
      const data = {
        _id: 'aedgs',
        type: Blacklist.TYPES.GUILD
      }
      const blacklist = new Blacklist(data)
      expect(blacklist.id).toEqual(data._id)
    })
  })
})
