process.env.TEST_ENV = true
const ScheduleStats = require('../../../structs/db/ScheduleStats.js')

jest.mock('../../../config.js')

describe('Unit::structs/db/ScheduleStats', function () {
  describe('constructor', function () {
    it('throws an error if _id is undefined', function () {
      expect(() => new ScheduleStats()).toThrowError('Undefined _id')
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const data = {
        _id: 'q23rew',
        feeds: 1,
        cycleTime: 2,
        cycleFails: 3,
        cycleURLs: 4,
        lastUpdated: 'q3ew2t4r'
      }
      const stats = new ScheduleStats(data)
      for (const key in data) {
        stats[key] = data[key]
      }
      expect(stats.toObject()).toEqual(data)
    })
  })
})
