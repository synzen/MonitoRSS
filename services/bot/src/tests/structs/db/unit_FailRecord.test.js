process.env.TEST_ENV = true
const FailRecord = require('../../../structs/db/FailRecord.js')

function getOldDate (hoursAgo) {
  // https://stackoverflow.com/questions/1050720/adding-hours-to-javascript-date-object
  const date = new Date()
  date.setTime(date.getTime() - hoursAgo * 60 * 60 * 1000)
  return date
}

describe('Unit::structs/db/FailRecord', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('initializes default values', function () {
      const data = {
        _id: 'aesdgdf'
      }
      const record = new FailRecord(data)
      expect(record.failedAt).toBeDefined()
      expect(record.reason).toBeUndefined()
    })
    it('initializes with given values', function () {
      const data = {
        _id: 'aesdgdf',
        reason: 'helaz'
      }
      const record = new FailRecord(data)
      expect(record._id).toEqual(data._id)
      expect(record.reason).toEqual(data.reason)
    })
  })
  describe('static record', function () {
    it('finds the right model', async function () {
      const spy = jest.spyOn(FailRecord, 'get').mockResolvedValue({
        save: jest.fn(),
        hasFailed: jest.fn().mockReturnValue(false)
      })
      const url = 'srfyhed'
      await FailRecord.record(url)
      expect(spy).toHaveBeenCalledWith(url)
    })
    it('updates the reason the model if it exists', async function () {
      const reason = 'ewstr4ydh'
      const found = {
        save: jest.fn(),
        hasFailed: jest.fn().mockReturnValue(false),
        reason: reason + 'abc'
      }
      jest.spyOn(FailRecord, 'get').mockResolvedValue(found)
      await FailRecord.record('', reason)
      expect(found.save).toHaveBeenCalledWith()
      expect(found.reason).toEqual(reason)
    })
    it('returns the record if it exists', async function () {
      const reason = 'rrr'
      const found = {
        save: jest.fn(),
        hasFailed: jest.fn().mockReturnValue(false),
        reason,
        alerted: true
      }
      jest.spyOn(FailRecord, 'get').mockResolvedValue(found)
      const returned = await FailRecord.record('', reason)
      expect(returned).toEqual(found)
    })
  })
  describe('static reset', function () {
    it('finds the right model', async function () {
      const spy = jest.spyOn(FailRecord, 'get').mockResolvedValue({
        delete: jest.fn()
      })
      const url = 'srfyhed'
      await FailRecord.reset(url)
      expect(spy).toHaveBeenCalledWith(url)
    })
    it('deletes the found model', async function () {
      const found = {
        delete: jest.fn()
      }
      jest.spyOn(FailRecord, 'get').mockResolvedValue(found)
      const url = 'srfyhed'
      await FailRecord.reset(url)
      expect(found.delete).toHaveBeenCalled()
    })
  })
  describe('static hasFailed', function () {
    it('returns false if getBy returns null', async function () {
      jest.spyOn(FailRecord, 'get').mockResolvedValue(null)
      const returned = await FailRecord.hasFailed()
      expect(returned).toEqual(false)
    })
    it('return the value of protoype.hasFailed if found', async function () {
      const hasFailed = jest.fn(() => true)
      const found = {
        hasFailed
      }
      jest.spyOn(FailRecord, 'get').mockResolvedValue(found)
      await expect(FailRecord.hasFailed())
        .resolves.toEqual(true)
      hasFailed.mockReturnValue(false)
      await expect(FailRecord.hasFailed())
        .resolves.toEqual(false)
    })
  })
  describe('pastCutoff', function () {
    const cutoff = 2
    const oldDate = getOldDate(cutoff + 1)
    const atDate = getOldDate(cutoff)
    const recentDate = getOldDate(cutoff - 1)
    beforeEach(function () {
      jest.spyOn(FailRecord, 'cutoff', 'get').mockReturnValue(cutoff)
    })
    it('returns false if cutoff is 0', function () {
      jest.spyOn(FailRecord, 'cutoff', 'get').mockReturnValue(0)
      const data = {
        _id: 'sg'
      }
      const record = new FailRecord(data)
      expect(record.pastCutoff()).toEqual(false)
    })
    it('returns false if failedAt is recent', function () {
      const data = {
        _id: 'sg'
      }
      const record = new FailRecord(data)
      record.failedAt = recentDate.toISOString()
      expect(record.pastCutoff()).toEqual(false)
    })
    it('returns true if count at or above limit', function () {
      const data = {
        _id: 'sg'
      }
      const record = new FailRecord(data)
      record.failedAt = atDate.toISOString()
      expect(record.pastCutoff()).toEqual(true)
      record.failedAt = oldDate.toISOString()
      expect(record.pastCutoff()).toEqual(true)
    })
  })
  describe('hasFailed', function () {
    it('returns pastCutoff func value', function () {
      const data = {
        _id: 'wseg'
      }
      const record = new FailRecord(data)
      const pastCutoff = 32546
      jest.spyOn(record, 'pastCutoff').mockReturnValue(pastCutoff)
      const returned = record.hasFailed()
      expect(returned).toEqual(pastCutoff)
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const data = {
        _id: 'aetgswr'
      }
      const record = new FailRecord(data)
      const url = 'w49y6huie'
      const reason = 'jackzzz'
      const failedAt = 'q3w24t6ery5tu6'
      const alerted = true
      record._id = url
      record.reason = reason
      record.failedAt = failedAt
      record.alerted = alerted
      const returned = record.toObject()
      expect(returned).toEqual({
        _id: url,
        reason,
        failedAt,
        alerted
      })
    })
  })
})
