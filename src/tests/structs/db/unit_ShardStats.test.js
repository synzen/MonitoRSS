process.env.TEST_ENV = true
const ShardStats = require('../../../structs/db/ShardStats.js')

jest.mock('../../../config.js')

describe('Unit::structs/db/ShardStats', function () {
  describe('constructor', function () {
    it('throws an error if _id is undefined', function () {
      expect(() => new ShardStats()).toThrowError('Undefined _id')
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
      const stats = new ShardStats(data)
      for (const key in data) {
        stats[key] = data[key]
      }
      expect(stats.toObject()).toEqual(data)
    })
  })
})
