process.env.TEST_ENV = true
const Feed = require('../../structs/db/Feed.js')
const pruneFeeds = require('../../maintenance/pruneFeeds.js')

jest.mock('../../structs/db/Feed.js')

describe('utils/maintenance/pruneFeeds', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  it('deletes the feeds whose channel is not in channelIds', async function () {
    const feeds = [{
      guild: 'a',
      channel: 'c1',
      delete: jest.fn()
    }, {
      guild: 'b',
      channel: 'c2',
      delete: jest.fn()
    }, {
      guild: 'foo',
      channel: 'c3',
      delete: jest.fn()
    }, {
      guild: 'c',
      channel: 'c4',
      delete: jest.fn()
    }]
    const guildIds = new Map([['a', 0], ['b', 0]])
    const channelIds = new Map([['c1', 0], ['c2', 0], ['c3', 0], ['c4', 0]])
    Feed.getAll.mockResolvedValue(feeds)
    await pruneFeeds(guildIds, channelIds)
    expect(feeds[0].delete).not.toHaveBeenCalled()
    expect(feeds[1].delete).not.toHaveBeenCalled()
    expect(feeds[2].delete).toHaveBeenCalledTimes(1)
    expect(feeds[3].delete).toHaveBeenCalledTimes(1)
  })
  it('deletes the feeds whose guild is not in guildIds', async function () {
    const feeds = [{
      guild: 'a',
      channel: 'c1',
      delete: jest.fn()
    }, {
      guild: 'b',
      channel: 'c2',
      delete: jest.fn()
    }, {
      guild: 'foo',
      channel: 'c3',
      delete: jest.fn()
    }, {
      guild: 'c',
      channel: 'c3',
      delete: jest.fn()
    }]
    const guildIds = new Map([['a', 0], ['c', 0], ['z', 0]])
    const channelIds = new Map([['c1', 0], ['c2', 0], ['c3', 0], ['c4', 0]])
    Feed.getAll.mockResolvedValue(feeds)
    await pruneFeeds(guildIds, channelIds)
    expect(feeds[0].delete).not.toHaveBeenCalled()
    expect(feeds[1].delete).toHaveBeenCalledTimes(1)
    expect(feeds[2].delete).toHaveBeenCalledTimes(1)
    expect(feeds[3].delete).not.toHaveBeenCalled()
  })
  it('returns the number of deleted feeds', async function () {
    const feeds = [{
      guild: 'a',
      channel: 'c1',
      delete: jest.fn()
    }, {
      guild: 'b',
      channel: 'c2',
      delete: jest.fn()
    }]
    const guildIds = new Map([['b', 0], ['c', 0], ['f', 0]])
    const channelIds = new Map([['c1', 0]])
    Feed.getAll.mockResolvedValue(feeds)
    const result = await pruneFeeds(guildIds, channelIds)
    expect(result).toEqual(2)
  })
})
