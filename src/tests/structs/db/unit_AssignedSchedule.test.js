const AssignedSchedule = require('../../../structs/db/AssignedSchedule.js')

describe('Unit::structs/db/AssignedSchedule', function () {
  describe('static getByFeedAndShard', function () {
    it('calls get correctly', async function () {
      const spy = jest.spyOn(AssignedSchedule, 'get').mockResolvedValue()
      await AssignedSchedule.getByFeedAndShard('abc', '123')
      expect(spy).toHaveBeenCalledWith('abc123')
    })
    it(`handles no shard correctly`, async function () {
      const spy = jest.spyOn(AssignedSchedule, 'get').mockResolvedValue()
      await AssignedSchedule.getByFeedAndShard('abc')
      expect(spy).toHaveBeenCalledWith('abc')
    })
  })
  describe('static getManyByFeedAndShard', function () {
    it('calls getManyBy correctly', async function () {
      const spy = jest.spyOn(AssignedSchedule, 'getManyBy').mockResolvedValue()
      const objects = [
        { feed: 'a', shard: 4 },
        { feed: 'b', shard: 6 }
      ]
      await AssignedSchedule.getManyByFeedAndShard(objects)
      expect(spy).toHaveBeenCalledWith([
        'a4',
        'b6'
      ])
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
      const assigned = new AssignedSchedule(data)
      const returned = assigned.toObject()
      expect(returned).toEqual({
        ...data,
        _id: data.feed + data.shard
      })
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
