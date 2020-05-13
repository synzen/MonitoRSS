process.env.TEST_ENV = true
const Supporter = require('../../structs/db/Supporter.js')
const pruneWebhooks = require('../../maintenance/pruneWebhooks')

jest.mock('../../structs/db/Supporter.js')

describe('Unit::maintenance/pruneWebhooks', function () {
  const bot = {
    shard: {
      ids: []
    },
    channels: {
      cache: {
        get: jest.fn()
      }
    }
  }
  beforeEach(function () {
    jest.restoreAllMocks()
    Supporter.mockReset()
    Supporter.enabled = false
    bot.channels.cache.get.mockReset()
  })
  it('does not delete authorized webhooks', async function () {
    const feeds = [{
      webhook: {
        id: '1'
      },
      save: jest.fn()
    }, {
      webhook: {
        id: '2'
      },
      save: jest.fn()
    }]
    const channelOne = {
      fetchWebhooks: async () => new Map([['2', {}]])
    }
    const channelThree = {
      fetchWebhooks: async () => new Map([['1', {}]])
    }
    bot.channels.cache.get
      // Fetching webhooks
      .mockReturnValueOnce(channelOne)
      .mockReturnValueOnce(channelThree)
      // Parsing them
      .mockReturnValueOnce(channelOne)
      .mockReturnValueOnce(channelThree)
    await pruneWebhooks(bot, feeds)
    expect(feeds[0].webhook).toBeDefined()
    expect(feeds[0].save).not.toHaveBeenCalled()
    expect(feeds[1].webhook).toBeDefined()
    expect(feeds[1].save).not.toHaveBeenCalledTimes(1)
  })
  it('deletes feeds with missing webhooks', async function () {
    const feeds = [{
      webhook: {
        id: '1'
      },
      save: jest.fn()
    }, {
      webhook: {
        id: '2'
      },
      save: jest.fn()
    }, {
      webhook: {
        id: '3'
      },
      save: jest.fn()
    }, {}]
    const channelOne = {
      fetchWebhooks: async () => new Map([['1', {}]])
    }
    const channelThree = {
      fetchWebhooks: async () => new Map([['3', {}]])
    }
    bot.channels.cache.get
      // Fetching webhooks
      .mockReturnValueOnce(channelThree)
      .mockReturnValueOnce(channelOne)
      .mockReturnValueOnce(channelOne)
      // Parsing
      .mockReturnValueOnce(channelThree)
      .mockReturnValueOnce(channelOne)
      .mockReturnValueOnce(channelOne)
    await pruneWebhooks(bot, feeds)
    expect(feeds[0].webhook).toBeDefined()
    expect(feeds[0].save).not.toHaveBeenCalled()
    expect(feeds[1].webhook).toBeUndefined()
    expect(feeds[1].save).toHaveBeenCalledTimes(1)
    expect(feeds[2].webhook).toBeDefined()
    expect(feeds[2].save).not.toHaveBeenCalled()
  })
  it('deletes webhooks in channel with 50013 errors', async function () {
    const feeds = [{
      webhook: {
        id: '1'
      },
      save: jest.fn()
    }]
    const error = new Error('azdsexyh')
    error.code = 50013
    const channelOne = {
      fetchWebhooks: jest.fn().mockRejectedValue(error)
    }
    bot.channels.cache.get
      .mockReturnValueOnce(channelOne)
      .mockReturnValueOnce(channelOne)
    await pruneWebhooks(bot, feeds)
    expect(feeds[0].webhook).toBeUndefined()
    expect(feeds[0].save).toHaveBeenCalled()
  })
  it('ignores feeds with missing channels', async function () {
    const feeds = [{
      webhook: {
        id: '1'
      },
      save: jest.fn()
    }, {
      webhook: {
        id: '2'
      },
      save: jest.fn()
    }]
    bot.channels.cache.get
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
    await pruneWebhooks(bot, feeds)
    expect(feeds[0].webhook).toBeDefined()
    expect(feeds[0].save).not.toHaveBeenCalled()
    expect(feeds[1].webhook).toBeDefined()
    expect(feeds[1].save).not.toHaveBeenCalled()
  })
  it('deletes unauthorized webhooks', async function () {
    const feeds = [{
      webhook: {
        id: '1'
      },
      save: jest.fn()
    }, {
      webhook: {
        id: '2'
      },
      save: jest.fn()
    }]
    const channelOne = {
      fetchWebhooks: async () => new Map([['1', {}]]),
      guild: {}
    }
    const channelTwo = {
      fetchWebhooks: async () => new Map([['2', {}]]),
      guild: {}
    }
    bot.channels.cache.get
      // Fetching webhooks
      .mockReturnValueOnce(channelTwo)
      .mockReturnValueOnce(channelOne)
      // Parsing
      .mockReturnValueOnce(channelTwo)
      .mockReturnValueOnce(channelOne)
    Supporter.enabled = true
    jest.spyOn(Supporter, 'hasValidGuild')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    await pruneWebhooks(bot, feeds)
    expect(feeds[0].webhook).toBeDefined()
    expect(feeds[0].save).not.toHaveBeenCalled()
    expect(feeds[1].webhook).toBeUndefined()
    expect(feeds[1].save).toHaveBeenCalledTimes(1)
  })
})
