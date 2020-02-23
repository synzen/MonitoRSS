process.env.TEST_ENV = true
const Feed = require('../../structs/db/Feed.js')
const FailRecord = require('../../structs/db/FailRecord.js')
const pruneFailRecords = require('../../maintenance/pruneFailRecords.js')

jest.mock('../../structs/db/Feed.js')
jest.mock('../../structs/db/FailRecord.js')

describe('Unit::utils/maintenance/pruneFailRecords', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  afterEach(function () {
    Feed.getAll.mockReset()
    FailRecord.getAll.mockReset()
  })
  it('deletes the records whose url does not exist', async function () {
    const failRecords = [{
      url: 'a',
      delete: jest.fn()
    }, {
      url: 'b',
      delete: jest.fn()
    }, {
      url: 'foo',
      delete: jest.fn()
    }, {
      url: 'c',
      delete: jest.fn()
    }]
    const feeds = [{
      url: 'a'
    }, {
      url: 'c'
    }, {
      url: 'z'
    }]
    Feed.getAll.mockResolvedValue(feeds)
    FailRecord.getAll.mockResolvedValue(failRecords)
    await pruneFailRecords()
    expect(failRecords[0].delete).not.toHaveBeenCalled()
    expect(failRecords[1].delete).toHaveBeenCalledTimes(1)
    expect(failRecords[2].delete).toHaveBeenCalledTimes(1)
    expect(failRecords[3].delete).not.toHaveBeenCalled()
  })
  it('returns the number of deleted failRecords', async function () {
    const failRecords = [{
      url: 'a',
      delete: jest.fn()
    }, {
      url: 'b',
      delete: jest.fn()
    }, {
      url: 'foo',
      delete: jest.fn()
    }, {
      url: 'c',
      delete: jest.fn()
    }]
    const feeds = [{
      url: 'a'
    }, {
      url: 'c'
    }, {
      url: 'z'
    }]
    Feed.getAll.mockResolvedValue(feeds)
    FailRecord.getAll.mockResolvedValue(failRecords)
    const result = await pruneFailRecords()
    expect(result).toEqual(2)
  })
})
