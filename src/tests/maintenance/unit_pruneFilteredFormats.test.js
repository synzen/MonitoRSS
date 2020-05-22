process.env.TEST_ENV = true
const FilteredFormat = require('../../structs/db/FilteredFormat.js')
const pruneFilteredFormats = require('../../maintenance/pruneFilteredFormats.js')

jest.mock('../../structs/db/Feed.js')
jest.mock('../../structs/db/FilteredFormat.js')

describe('Unit::maintenance/pruneFilteredFormats', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  afterEach(function () {
    FilteredFormat.getAll.mockReset()
  })
  it('deletes the formats whose feed does not exist', async function () {
    const FilteredFormats = [{
      feed: 'a',
      delete: jest.fn()
    }, {
      feed: 'b',
      delete: jest.fn()
    }, {
      feed: 'foo',
      delete: jest.fn()
    }, {
      feed: 'c',
      delete: jest.fn()
    }]
    const feeds = [{
      _id: 'a'
    }, {
      _id: 'c'
    }, {
      _id: 'z'
    }]
    FilteredFormat.getAll.mockResolvedValue(FilteredFormats)
    await pruneFilteredFormats(feeds)
    expect(FilteredFormats[0].delete).not.toHaveBeenCalled()
    expect(FilteredFormats[1].delete).toHaveBeenCalledTimes(1)
    expect(FilteredFormats[2].delete).toHaveBeenCalledTimes(1)
    expect(FilteredFormats[3].delete).not.toHaveBeenCalled()
  })
  it('returns the number of deleted formats', async function () {
    const filteredFormats = [{
      feed: 'a',
      delete: jest.fn()
    }, {
      feed: 'b',
      delete: jest.fn()
    }, {
      feed: 'foo',
      delete: jest.fn()
    }, {
      feed: 'c',
      delete: jest.fn()
    }]
    const feeds = [{
      _id: 'a'
    }, {
      _id: 'c'
    }, {
      _id: 'z'
    }]
    FilteredFormat.getAll.mockResolvedValue(filteredFormats)
    const result = await pruneFilteredFormats(feeds)
    expect(result).toEqual(2)
  })
})
