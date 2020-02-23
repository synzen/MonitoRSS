process.env.TEST_ENV = true
const Feed = require('../../structs/db/Feed.js')
const FilteredFormat = require('../../structs/db/FilteredFormat.js')
const pruneFilteredFormats = require('../../maintenance/pruneFilteredFormats.js')

jest.mock('../../structs/db/Feed.js')
jest.mock('../../structs/db/FilteredFormat.js')

describe('utils/maintenance/pruneFilteredFormats', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  afterEach(function () {
    Feed.getAll.mockReset()
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
    Feed.getAll.mockResolvedValue(feeds)
    FilteredFormat.getAll.mockResolvedValue(FilteredFormats)
    await pruneFilteredFormats()
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
    Feed.getAll.mockResolvedValue(feeds)
    FilteredFormat.getAll.mockResolvedValue(filteredFormats)
    const result = await pruneFilteredFormats()
    expect(result).toEqual(2)
  })
})
