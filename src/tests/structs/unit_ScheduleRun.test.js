const ScheduleRun = require('../../structs/ScheduleRun.js')

describe('Unit::structs/ScheduleRun', function () {
  const basicSchedule = {
    name: 'awsdefgr',
    refreshRateMinutes: 55,
    keywords: ['35']
  }
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
