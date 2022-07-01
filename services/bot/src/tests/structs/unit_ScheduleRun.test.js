const ScheduleRun = require('../../structs/ScheduleRun.js')
const Supporter = require('../../structs/db/Supporter.js')
const FailRecord = require('../../structs/db/FailRecord.js')
const maintenance = require('../../maintenance/index.js')

jest.mock('../../structs/db/Schedule.js')
jest.mock('../../structs/db/Supporter.js')
jest.mock('../../structs/Guild.js')
jest.mock('../../structs/db/FailRecord.js')
jest.mock('../../maintenance/index.js')

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
  describe('updateFeedsStatus', function () {
    it('runs the right func', async function () {
      const run = new ScheduleRun(basicSchedule)
      maintenance.checkLimits.limits
        .mockResolvedValue({
          enabled: [1, 2],
          disabled: [3, 4]
        })
      const emit = jest.spyOn(run, 'emit')
      await run.updateFeedsStatus([])
      expect(emit).toHaveBeenCalledWith('feedEnabled', 1)
      expect(emit).toHaveBeenCalledWith('feedEnabled', 2)
      expect(emit).toHaveBeenCalledWith('feedDisabled', 3)
      expect(emit).toHaveBeenCalledWith('feedDisabled', 4)
    })
  })
  describe('getFailRecordsMap', function () {
    it('returns correctly', async function () {
      const failRecords = [{
        _id: 'a',
        key: '1'
      }, {
        _id: 'b',
        key: '2'
      }]
      FailRecord.getManyByQuery.mockResolvedValue(failRecords)
      const run = new ScheduleRun(basicSchedule)
      await expect(run.getFailRecordsMap([]))
        .resolves.toEqual(new Map([
          ['a', failRecords[0]],
          ['b', failRecords[1]]
        ]))
    })
  })
  describe('getScheduleFeeds', function () {
    it('returns all feeds of this schedule', async function () {
      const scheduleName = 'abaesdgr'
      const run = new ScheduleRun(basicSchedule)
      run.name = scheduleName
      const feeds = [{
        key: 1,
        determineSchedule: async () => ({ name: scheduleName })
      }, {
        key: 2,
        determineSchedule: async () => ({ name: scheduleName + 'other' })
      }, {
        key: 3,
        determineSchedule: async () => ({ name: scheduleName })
      }]
      const returned = await run.getScheduleFeeds(feeds)
      expect(returned).toEqual([
        feeds[0],
        feeds[2]
      ])
    })
  })
  describe('getEligibleFeeds', function () {
    beforeEach(function () {
      jest.spyOn(ScheduleRun.prototype, 'isEligibleFeed')
        .mockImplementation()
    })
    it('excludes ineligible feeds', async function () {
      const scheduleName = 'abaesdgr'
      const run = new ScheduleRun(basicSchedule)
      run.name = scheduleName
      const feeds = [{
        key: 1
      }, {
        key: 2
      }, {
        key: 3
      }]
      jest.spyOn(run, 'isEligibleFeed')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
      const returned = await run.getEligibleFeeds(feeds, new Map(), new Set())
      expect(returned).toEqual([
        feeds[1]
      ])
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
    it('returns false if fail record has failed', function () {
      const run = new ScheduleRun(basicSchedule)
      const feedObject = {
        disabled: false,
        url: 'abc123'
      }
      const failRecordMap = new Map([
        [feedObject.url, {
          hasFailed: jest.fn().mockReturnValue(true)
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
          hasFailed: jest.fn().mockReturnValue(false)
        }]
      ])
      expect(run.isEligibleFeed(feedObject, failRecordMap, new Set()))
        .toEqual(true)
    })
  })
  describe('convertFeedsToJSON', function () {
    it('returns json of feeds', function () {
      const run = new ScheduleRun(basicSchedule)
      const feeds = [{
        toJSON: () => 1
      }, {
        toJSON: () => 2
      }, {
        toJSON: () => 3
      }]
      const returned = run.convertFeedsToJSON(feeds)
      expect(returned).toEqual([1, 2, 3])
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
  describe('createURLRecords', function () {
    it('creates the records correctly', function () {
      const run = new ScheduleRun(basicSchedule)
      const batches = [
        {
          url1: {},
          url2: {}
        }, {
          url3: {},
          url4: {}
        }, {
          url5: {},
          url6: {}
        }, {
          url7: {}
        }
      ]
      run.createURLRecords(batches)
      expect(run.urlBatchRecords).toEqual([
        new Set(['url1', 'url2']),
        new Set(['url3', 'url4']),
        new Set(['url5', 'url6']),
        new Set(['url7'])
      ])
    })
    it('creates counts correctly', function () {
      const run = new ScheduleRun(basicSchedule)
      const batchGroups = [
        {
          url1: {},
          url2: {}
        }, {
          url3: {},
          url4: {}
        }, {
          url5: {},
          url6: {}
        }, {
          url7: {}
        }
      ]
      run.createURLRecords(batchGroups)
      expect(run.urlSizeRecords).toEqual([
        2, 2, 2, 1
      ])
    })
  })
  describe('removeFromBatchRecords', function () {
    it('removes correctly', function () {
      const run = new ScheduleRun(basicSchedule)
      run.urlBatchRecords = [
        new Set(['url1', 'url2']),
        new Set(['url3', 'url4']),
        new Set(['url5', 'url6']),
        new Set(['url7'])
      ]
      run.removeFromBatchRecords(3, 'url7')
      expect(run.urlBatchRecords).toEqual([
        new Set(['url1', 'url2']),
        new Set(['url3', 'url4']),
        new Set(['url5', 'url6']),
        new Set()
      ])
      run.removeFromBatchRecords(1, 'url3')
      expect(run.urlBatchRecords).toEqual([
        new Set(['url1', 'url2']),
        new Set(['url4']),
        new Set(['url5', 'url6']),
        new Set()
      ])
    })
  })
  describe('getHungUpURLs', function () {
    it('returns correctly for mid-progress batches', function () {
      const run = new ScheduleRun(basicSchedule)
      run.urlBatchRecords = [
        new Set(['url1', 'url2']),
        new Set(['url3']),
        new Set(['url5']),
        new Set(['url7'])
      ]
      run.urlSizeRecords = [
        2, 2, 2, 1
      ]
      expect(run.getHungUpURLs()).toEqual({
        summary: [
          ['url3'],
          ['url5']
        ],
        remaining: [
          2, 1, 1, 1
        ],
        total: 5
      })
    })
  })
})
