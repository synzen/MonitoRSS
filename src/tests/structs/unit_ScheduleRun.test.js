const ScheduleRun = require('../../structs/ScheduleRun.js')
const Supporter = require('../../structs/db/Supporter.js')
const FailRecord = require('../../structs/db/FailRecord.js')

jest.mock('../../structs/db/Schedule.js')
jest.mock('../../structs/db/Supporter.js')
jest.mock('../../structs/db/FailRecord.js')

Supporter.schedule = {
  name: 'default'
}

describe('Unit::structs/ScheduleRun', function () {
  afterEach(function () {
    jest.restoreAllMocks()
    FailRecord.mockReset()
  })
  const basicSchedule = {
    name: 'awsdefgr',
    refreshRateMinutes: 55,
    keywords: ['35']
  }
  describe('getFailRecordMap', function () {
    it('returns correctly', async function () {
      const failRecords = [{
        url: 'a',
        key: '1'
      }, {
        url: 'b',
        key: '2'
      }]
      FailRecord.getAll.mockResolvedValue(failRecords)
      const run = new ScheduleRun(basicSchedule)
      await expect(run.getFailRecordMap())
        .resolves.toEqual(new Map([
          ['a', failRecords[0]],
          ['b', failRecords[1]]
        ]))
    })
  })
  describe('getApplicableFeeds', function () {
    beforeEach(function () {
      jest.spyOn(ScheduleRun.prototype, 'isEligibleFeed')
        .mockImplementation()
    })
    it('returns all feeds of this schedule', async function () {
      const scheduleName = 'abaesdgr'
      const run = new ScheduleRun(basicSchedule)
      run.name = scheduleName
      const feeds = [{
        key: 1,
        determineSchedule: async () => ({ name: scheduleName }),
        toJSON: () => 'feed1'
      }, {
        key: 2,
        determineSchedule: async () => ({ name: scheduleName + 'other' }),
        toJSON: () => 'feed2'
      }, {
        key: 3,
        determineSchedule: async () => ({ name: scheduleName }),
        toJSON: () => 'feed3'
      }]
      jest.spyOn(run, 'isEligibleFeed')
        .mockReturnValue(true)
      const returned = await run.getApplicableFeeds(feeds, new Map(), new Set())
      expect(returned).toEqual([
        'feed1',
        'feed3'
      ])
    })
    it('excludes ineligible feeds', async function () {
      const scheduleName = 'abaesdgr'
      const run = new ScheduleRun(basicSchedule)
      run.name = scheduleName
      const feeds = [{
        key: 1,
        determineSchedule: async () => ({ name: scheduleName }),
        toJSON: () => 'feed1'
      }, {
        key: 2,
        determineSchedule: async () => ({ name: scheduleName }),
        toJSON: () => 'feed2'
      }, {
        key: 3,
        determineSchedule: async () => ({ name: scheduleName }),
        toJSON: () => 'feed3'
      }]
      jest.spyOn(run, 'isEligibleFeed')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
      const returned = await run.getApplicableFeeds(feeds, new Map(), new Set())
      expect(returned).toEqual(expect.not.arrayContaining([
        'feed1',
        'feed3'
      ]))
    })
  })
  describe('isEligibleFeed', function () {
    it('returns false if feed is disabled', function () {
      const run = new ScheduleRun(basicSchedule)
      const feedObject = {
        disabled: true
      }
      expect(run.isEligibleFeed(feedObject, new Map(), new Set()))
        .toEqual(false)
    })
    it('returns false if fail record was alerted', function () {
      const run = new ScheduleRun(basicSchedule)
      const feedObject = {
        disabled: false,
        url: 'abc123'
      }
      const failRecordMap = new Map([
        [feedObject.url, {
          alerted: true
        }]
      ])
      expect(run.isEligibleFeed(feedObject, failRecordMap, new Set()))
        .toEqual(false)
    })
    it('returns true if eligible', function () {
      const run = new ScheduleRun(basicSchedule)
      const feedObject = {
        disabled: false,
        url: 'abc123'
      }
      const failRecordMap = new Map([
        [feedObject.url, {
          alerted: false
        }]
      ])
      expect(run.isEligibleFeed(feedObject, failRecordMap, new Set()))
        .toEqual(true)
    })
  })
  describe('mapFeedsByURL', function () {
    it('maps correctly', function () {
      const run = new ScheduleRun(basicSchedule)
      const feedObjects = [{
        url: 'a',
        _id: 'feed1'
      }, {
        url: 'b',
        _id: 'feed2'
      }, {
        url: 'b',
        _id: 'feed3'
      }, {
        url: 'c',
        _id: 'feed4'
      }]
      const returned = run.mapFeedsByURL(feedObjects, new Set())
      const keys = Array.from(returned.keys())
      expect(keys).toHaveLength(3)
      expect(keys).toEqual(expect.arrayContaining([
        'a',
        'b',
        'c'
      ]))
      expect(returned.get('a')).toEqual({
        feed1: {
          _id: 'feed1',
          url: 'a'
        }
      })
      expect(returned.get('b')).toEqual({
        feed2: {
          _id: 'feed2',
          url: 'b'
        },
        feed3: {
          _id: 'feed3',
          url: 'b'
        }
      })
      expect(returned.get('c')).toEqual({
        feed4: {
          _id: 'feed4',
          url: 'c'
        }
      })
    })
  })
  describe('createBatches', function () {
    it('returns the batches', function () {
      const run = new ScheduleRun(basicSchedule)
      const url1Feeds = {
        feed1: {},
        feed2: {}
      }
      const url2Feeds = {
        feed3: {}
      }
      const url3Feeds = {
        feed4: {},
        feed5: {}
      }
      const urlMap = new Map([
        ['url1', url1Feeds],
        ['url2', url2Feeds],
        ['url3', url3Feeds]
      ])
      const returned = run.createBatches(urlMap, 2, new Set())
      expect(returned).toHaveLength(2)
      expect(returned).toEqual([{
        url1: url1Feeds,
        url2: url2Feeds
      }, {
        url3: url3Feeds
      }])
    })
  })
  describe('creaetBatchGroups', function () {
    it('returns the batch groups', function () {
      const run = new ScheduleRun(basicSchedule)
      const batches = [{
        a: {},
        b: {}
      }, {
        c: {},
        d: {}
      }, {
        e: {}
      }]
      const groupSize = 2
      const returned = run.createBatchGroups(batches, groupSize)
      expect(returned).toEqual([
        [batches[0], batches[1]],
        [batches[2]]
      ])
    })
  })
  describe('createURLRecords', function () {
    it('creates the records correctly', function () {
      const run = new ScheduleRun(basicSchedule)
      const batchGroups = [
        [{
          url1: {},
          url2: {}
        }, {
          url3: {},
          url4: {}
        }], [{
          url5: {},
          url6: {}
        }, {
          url7: {}
        }]
      ]
      run.createURLRecords(batchGroups)
      expect(run.urlBatchGroups).toEqual([
        [new Set(['url1', 'url2']), new Set(['url3', 'url4'])],
        [new Set(['url5', 'url6']), new Set(['url7'])]
      ])
    })
    it('creates counts correctly', function () {
      const run = new ScheduleRun(basicSchedule)
      const batchGroups = [
        [{
          url1: {},
          url2: {}
        }, {
          url3: {},
          url4: {}
        }], [{
          url5: {},
          url6: {}
        }, {
          url7: {}
        }]
      ]
      run.createURLRecords(batchGroups)
      expect(run.urlSizeGroups).toEqual([
        [2, 2],
        [2, 1]
      ])
    })
  })
  describe('removeFromBatchRecords', function () {
    it('removes correctly', function () {
      const run = new ScheduleRun(basicSchedule)
      run.urlBatchGroups = [
        [new Set(['url1', 'url2']), new Set(['url3', 'url4'])],
        [new Set(['url5', 'url6']), new Set(['url7'])]
      ]
      run.removeFromBatchRecords(1, 1, 'url7')
      expect(run.urlBatchGroups).toEqual([
        [new Set(['url1', 'url2']), new Set(['url3', 'url4'])],
        [new Set(['url5', 'url6']), new Set()]
      ])
      run.removeFromBatchRecords(0, 0, 'url2')
      expect(run.urlBatchGroups).toEqual([
        [new Set(['url1']), new Set(['url3', 'url4'])],
        [new Set(['url5', 'url6']), new Set()]
      ])
    })
  })
  describe('getHungUpURLs', function () {
    it('returns correctly for mid-progress batches', function () {
      const run = new ScheduleRun(basicSchedule)
      run.urlBatchGroups = [
        [new Set(['url1', 'url2']), new Set(['url3'])],
        [new Set(['url5']), new Set(['url7'])]
      ]
      run.urlSizeGroups = [
        [2, 2],
        [2, 1]
      ]
      expect(run.getHungUpURLs()).toEqual([
        [['url3']],
        [['url5']]
      ])
    })
  })
})
