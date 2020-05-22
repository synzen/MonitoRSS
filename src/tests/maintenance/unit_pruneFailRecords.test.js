process.env.TEST_ENV = true
const FailRecord = require('../../structs/db/FailRecord.js')
const pruneFailRecords = require('../../maintenance/pruneFailRecords.js')

jest.mock('../../structs/db/FailRecord.js')

describe('Unit::maintenance/pruneFailRecords', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  afterEach(function () {
    FailRecord.getAll.mockReset()
  })
  it('deletes the records whose url does not exist', async function () {
    const failRecords = [{
      _id: 'a',
      delete: jest.fn()
    }, {
      _id: 'b',
      delete: jest.fn()
    }, {
      _id: 'foo',
      delete: jest.fn()
    }, {
      _id: 'c',
      delete: jest.fn()
    }]
    const feeds = [{
      url: 'a'
    }, {
      url: 'c'
    }, {
      url: 'z'
    }]
    FailRecord.getAll.mockResolvedValue(failRecords)
    await pruneFailRecords(feeds)
    expect(failRecords[0].delete).not.toHaveBeenCalled()
    expect(failRecords[1].delete).toHaveBeenCalledTimes(1)
    expect(failRecords[2].delete).toHaveBeenCalledTimes(1)
    expect(failRecords[3].delete).not.toHaveBeenCalled()
  })
  it('returns the number of deleted failRecords', async function () {
    const failRecords = [{
      _id: 'a',
      delete: jest.fn()
    }, {
      _id: 'b',
      delete: jest.fn()
    }, {
      _id: 'foo',
      delete: jest.fn()
    }, {
      _id: 'c',
      delete: jest.fn()
    }]
    const feeds = [{
      url: 'a'
    }, {
      url: 'c'
    }, {
      url: 'z'
    }]
    FailRecord.getAll.mockResolvedValue(failRecords)
    const result = await pruneFailRecords(feeds)
    expect(result).toEqual(2)
  })
})
