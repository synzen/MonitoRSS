process.env.TEST_ENV = true
const Feed = require('../../../structs/db/Feed.js')
const Format = require('../../../structs/db/Format.js')
const pruneFormats = require('../../../util/maintenance/pruneFormats.js')

jest.mock('../../../structs/db/Feed.js')
jest.mock('../../../structs/db/Format.js')

describe('utils/maintenance/pruneFeeds', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  afterEach(function () {
    Feed.getAll.mockReset()
    Format.getAll.mockReset()
  })
  it('deletes the formats whose feed does not exist', async function () {
    const formats = [{
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
    Format.getAll.mockResolvedValue(formats)
    await pruneFormats()
    expect(formats[0].delete).not.toHaveBeenCalled()
    expect(formats[1].delete).toHaveBeenCalledTimes(1)
    expect(formats[2].delete).toHaveBeenCalledTimes(1)
    expect(formats[3].delete).not.toHaveBeenCalled()
  })
  it('returns the number of deleted formats', async function () {
    const formats = [{
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
    Format.getAll.mockResolvedValue(formats)
    const result = await pruneFormats()
    expect(result).toEqual(2)
  })
})
