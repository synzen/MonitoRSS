process.env.TEST_ENV = true
const KeyValue = require('../../../structs/db/KeyValue.js')

jest.mock('../../../config.js')

describe('Unit::structs/db/KeyValue', function () {
  describe('constructor', function () {
    it('throws for undefined id', function () {
      const data = {
        value: 123
      }
      expect(() => new KeyValue(data))
        .toThrow(new TypeError('_id is undefined'))
    })
    it('throws for undefined value', function () {
      const data = {
        _id: 'asd'
      }
      expect(() => new KeyValue(data))
        .toThrow(new TypeError('value is undefined'))
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const data = {
        _id: 'srfh',
        value: '3e45y'
      }
      const kv = new KeyValue({ ...data })
      const returned = kv.toObject()
      expect(returned).toEqual(data)
    })
  })
})
