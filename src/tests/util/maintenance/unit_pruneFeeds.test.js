process.env.TEST_ENV = true
const Feed = require('../../../structs/db/Feed.js')
const pruneFeeds = require('../../../util/maintenance/pruneFeeds.js')

jest.mock('../../../structs/db/Feed.js')

describe('utils/maintenance/pruneFeeds', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  it('deletes the feeds whose guild is not in guildIds', async function () {
    const feeds = [{
      guild: 'a',
      delete: jest.fn()
    }, {
      guild: 'b',
      delete: jest.fn()
    }, {
      guild: 'foo',
      delete: jest.fn()
    }, {
      guild: 'c',
      delete: jest.fn()
    }]
    const guildIds = new Set(['a', 'c', 'z'])
    Feed.getAll.mockResolvedValue(feeds)
    await pruneFeeds(guildIds)
    expect(feeds[0].delete).not.toHaveBeenCalled()
    expect(feeds[1].delete).toHaveBeenCalledTimes(1)
    expect(feeds[2].delete).toHaveBeenCalledTimes(1)
    expect(feeds[3].delete).not.toHaveBeenCalled()
  })
  it('returns the number of deleted feeds', async function () {
    const feeds = [{
      guild: 'a',
      delete: jest.fn()
    }, {
      guild: 'b',
      delete: jest.fn()
    }, {
      guild: 'foo',
      delete: jest.fn()
    }, {
      guild: 'c',
      delete: jest.fn()
    }]
    const guildIds = new Set(['a', 'c', 'f'])
    Feed.getAll.mockResolvedValue(feeds)
    const result = await pruneFeeds(guildIds)
    expect(result).toEqual(2)
  })
})
