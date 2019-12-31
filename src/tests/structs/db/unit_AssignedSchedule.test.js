const AssignedSchedule = require('../../../structs/db/AssignedSchedule.js')

describe('Unit::structs/db/AssignedSchedule', function () {
  describe('static getByFeedAndShard', function () {
    it('calls get correctly', async function () {
      const spy = jest.spyOn(AssignedSchedule, 'getByQuery').mockResolvedValue()
      await AssignedSchedule.getByFeedAndShard('abc', '123')
      expect(spy).toHaveBeenCalledWith({
        feed: 'abc',
        shard: '123'
      })
    })
    it(`handles no shard correctly`, async function () {
      const spy = jest.spyOn(AssignedSchedule, 'getByQuery').mockResolvedValue()
      await AssignedSchedule.getByFeedAndShard('abc')
      expect(spy).toHaveBeenCalledWith({
        feed: 'abc',
        shard: -1
      })
    })
  })
  describe('toObject', function () {
    it('returns correctly', async function () {
      const data = {
        guild: 'ASDBA',
        feed: 'aedsrhd',
        url: 'srghf',
        schedule: 'segr',
        shard: 1
      }
      const assigned = new AssignedSchedule({ ...data })
      const returned = assigned.toObject()
      expect(returned).toEqual(data)
    })
  })
  describe('constructor', function () {
    it('throws correctly', async function () {
      const data = {
        guild: 'ASDBA',
        feed: 'aedsrhd',
        url: 'srghf',
        schedule: 'segr',
        shard: 1
      }
      for (const key in data) {
        const toUse = {
          ...data,
          [key]: undefined
        }
        expect(() => new AssignedSchedule(toUse))
          .toThrow(`${key} is undefined`)
      }
    })
  })
})
