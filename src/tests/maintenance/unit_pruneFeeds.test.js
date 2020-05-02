process.env.TEST_ENV = true
const pruneFeeds = require('../../maintenance/pruneFeeds.js')

describe('Unit::maintenance/pruneFeeds', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  it('deletes the feeds whose channel is not in channelIds', async function () {
    const feed1 = {
      guild: 'a',
      channel: 'c1',
      delete: jest.fn()
    }
    const feed2 = {
      guild: 'b',
      channel: 'c2',
      delete: jest.fn()
    }
    const feed3 = {
      guild: 'foo',
      channel: 'c3',
      delete: jest.fn()
    }
    const feed4 = {
      guild: 'c',
      channel: 'c4',
      delete: jest.fn()
    }
    const feeds = [feed1, feed2, feed3, feed4]
    const guildIds = new Map([['a', 0], ['b', 0]])
    const channelIds = new Map([['c1', 0], ['c2', 0], ['c3', 0], ['c4', 0]])
    await pruneFeeds(feeds, guildIds, channelIds)
    expect(feed1.delete).not.toHaveBeenCalled()
    expect(feed2.delete).not.toHaveBeenCalled()
    expect(feed3.delete).toHaveBeenCalledTimes(1)
    expect(feed4.delete).toHaveBeenCalledTimes(1)
  })
  it('slices the deleted feeds from the array', async function () {
    const feed1 = {
      guild: 'a',
      channel: 'c1',
      delete: jest.fn()
    }
    const feed2 = {
      guild: 'b',
      channel: 'c2',
      delete: jest.fn()
    }
    const feed3 = {
      guild: 'c',
      channel: 'c3',
      delete: jest.fn()
    }
    const feeds = [feed1, feed2, feed3]
    const guildIds = new Map([['a', 0], ['d', 0]])
    const channelIds = new Map([['c1', 0], ['c2', 0], ['c4', 0]])
    await pruneFeeds(feeds, guildIds, channelIds)
    expect(feeds).not.toContain(feed2)
  })
  it('deletes the feeds whose guild is not in guildIds', async function () {
    const feed1 = {
      guild: 'a',
      channel: 'c1',
      delete: jest.fn()
    }
    const feed2 = {
      guild: 'b',
      channel: 'c2',
      delete: jest.fn()
    }
    const feed3 = {
      guild: 'foo',
      channel: 'c3',
      delete: jest.fn()
    }
    const feed4 = {
      guild: 'c',
      channel: 'c4',
      delete: jest.fn()
    }
    const feeds = [feed1, feed2, feed3, feed4]
    const guildIds = new Map([['a', 0], ['c', 0], ['z', 0]])
    const channelIds = new Map([['c1', 0], ['c2', 0], ['c3', 0], ['c4', 0]])
    await pruneFeeds(feeds, guildIds, channelIds)
    expect(feed1.delete).not.toHaveBeenCalled()
    expect(feed2.delete).toHaveBeenCalledTimes(1)
    expect(feed3.delete).toHaveBeenCalledTimes(1)
    expect(feed4.delete).not.toHaveBeenCalled()
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
    const result = await pruneFeeds(feeds, guildIds, channelIds)
    expect(result).toEqual(2)
  })
})
