process.env.TEST_ENV = true
const Schedule = require('../../../structs/db/Schedule.js')

jest.mock('../../../config.js')

describe('Unit::structs/db/Schedule', function () {
  describe('constructor', function () {
    it('throws if name is missing', function () {
      expect(() => new Schedule({
        refreshRateMinutes: 34,
        keywords: ['ab'],
        feeds: ['asd']
      })).toThrow('name is undefined')
    })
    it('throws if refreshRateMinutes is missing', function () {
      expect(() => new Schedule({
        name: 'hello',
        keywords: ['ab'],
        feeds: ['asd']
      })).toThrow('refreshRateMinutes is undefined')
    })
    it('throws if refreshRateMinutes is not a number', function () {
      expect(() => new Schedule({
        refreshRateMinutes: 'jackalope',
        name: 'hello',
        keywords: ['ab'],
        feeds: ['asd']
      })).toThrow('refreshRateMinutes must be a number')
    })
    it('does not throw if name and refresh rate is defined', function () {
      expect(() => new Schedule({
        name: 'hello',
        refreshRateMinutes: 12,
        keywords: ['ab'],
        feeds: ['asd']
      })).not.toThrow()
    })
    it('does not throw if keywords and feeds is undefined', function () {
      expect(() => new Schedule({
        name: 'hello',
        refreshRateMinutes: 12
      })).not.toThrow()
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const data = {
        name: 'hello',
        refreshRateMinutes: 12,
        keywords: ['ab'],
        feeds: ['asd']
      }
      const schedule = new Schedule(data)
      const returned = schedule.toObject()
      expect(returned).toEqual(data)
    })
  })
})
