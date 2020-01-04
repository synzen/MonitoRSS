process.env.TEST_ENV = true
const Feed = require('../../../structs/db/Feed.js')
const FailCounter = require('../../../structs/db/FailCounter.js')
const pruneFailCounters = require('../../../util/maintenance/pruneFailCounters.js')

jest.mock('../../../structs/db/Feed.js')
jest.mock('../../../structs/db/FailCounter.js')

describe('utils/maintenance/pruneFeeds', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  afterEach(function () {
    Feed.getAll.mockReset()
    FailCounter.getAll.mockReset()
  })
  it('deletes the counters whose url does not exist', async function () {
    const failCounters = [{
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
    FailCounter.getAll.mockResolvedValue(failCounters)
    await pruneFailCounters()
    expect(failCounters[0].delete).not.toHaveBeenCalled()
    expect(failCounters[1].delete).toHaveBeenCalledTimes(1)
    expect(failCounters[2].delete).toHaveBeenCalledTimes(1)
    expect(failCounters[3].delete).not.toHaveBeenCalled()
  })
  it('returns the number of deleted failCounters', async function () {
    const failCounters = [{
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
    FailCounter.getAll.mockResolvedValue(failCounters)
    const result = await pruneFailCounters()
    expect(result).toEqual(2)
  })
})
