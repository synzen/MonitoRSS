process.env.TEST_ENV = true
const Supporter = require('../../structs/db/Supporter.js')
const Guild = require('../../structs/Guild.js')
const pruneWebhooks = require('../../maintenance/pruneWebhooks')

jest.mock('../../structs/db/Supporter.js')
jest.mock('../../structs/Guild.js')

describe('Unit::maintenance/pruneWebhooks', function () {
  const bot = {
    shard: {
      ids: []
    },
    channels: {
      cache: {
        get: jest.fn().mockReturnValue({})
      }
    }
  }
  afterEach(function () {
    jest.restoreAllMocks()
    Supporter.mockReset()
    Supporter.enabled = false
    bot.channels.cache.get.mockReturnValue({})
  })
  describe('pruneWebhooks', function () {
    it('removes feeds that has reasons to remove', async function () {
      const relevantFeeds = [{
        channel: 1,
        webhook: {
          name: 'a'
        },
        save: jest.fn()
      }, {
        channel: 1,
        webhook: {
          name: 'b'
        },
        save: jest.fn()
      }, {
        channel: 1,
        webhook: {
          name: 'c'
        },
        save: jest.fn()
      }]
      const webhookFetchData = new Map([
        [1, {}]
      ])
      jest.spyOn(pruneWebhooks, 'getRelevantFeeds')
        .mockReturnValue(relevantFeeds)
      jest.spyOn(pruneWebhooks, 'fetchChannelWebhooks')
        .mockReturnValue(webhookFetchData)
      jest.spyOn(pruneWebhooks, 'getRemoveReason')
        .mockReturnValueOnce('reason1')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('reason2')
      jest.spyOn(pruneWebhooks, 'getDisableReason')
        .mockResolvedValueOnce('')
      await pruneWebhooks.pruneWebhooks(bot, [])
      expect(relevantFeeds[0].webhook).toBeUndefined()
      expect(relevantFeeds[0].save).toHaveBeenCalledTimes(1)
      expect(relevantFeeds[1].webhook).toBeDefined()
      expect(relevantFeeds[1].save).toHaveBeenCalledTimes(0)
      expect(relevantFeeds[2].webhook).toBeUndefined()
      expect(relevantFeeds[2].save).toHaveBeenCalledTimes(1)
    })
    it('disables the webhooks that should be disabled', async () => {
      const relevantFeeds = [{
        channel: 1,
        webhook: {
          name: 'a'
        },
        save: jest.fn()
      }, {
        channel: 1,
        webhook: {
          name: 'b'
        },
        save: jest.fn()
      }]
      const webhookFetchData = new Map([
        [1, {}]
      ])
      jest.spyOn(pruneWebhooks, 'getRelevantFeeds')
        .mockReturnValue(relevantFeeds)
      jest.spyOn(pruneWebhooks, 'fetchChannelWebhooks')
        .mockReturnValue(webhookFetchData)
      jest.spyOn(pruneWebhooks, 'getRemoveReason')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
      jest.spyOn(pruneWebhooks, 'getDisableReason')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('disablereason2')
      await pruneWebhooks.pruneWebhooks(bot, [])
      expect(relevantFeeds[0].webhook.disabled).toBeUndefined()
      expect(relevantFeeds[0].save).toHaveBeenCalledTimes(0)
      expect(relevantFeeds[1].webhook.disabled).toEqual(true)
      expect(relevantFeeds[1].save).toHaveBeenCalledTimes(1)
    })
    it('enables the webhooks that should be enabled', async () => {
      const relevantFeeds = [{
        channel: 1,
        webhook: {
          name: 'a',
          disabled: true
        },
        save: jest.fn()
      }, {
        channel: 1,
        webhook: {
          name: 'b',
          disabled: true
        },
        save: jest.fn()
      }]
      const webhookFetchData = new Map([
        [1, {}]
      ])
      jest.spyOn(pruneWebhooks, 'getRelevantFeeds')
        .mockReturnValue(relevantFeeds)
      jest.spyOn(pruneWebhooks, 'fetchChannelWebhooks')
        .mockReturnValue(webhookFetchData)
      jest.spyOn(pruneWebhooks, 'getRemoveReason')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
      jest.spyOn(pruneWebhooks, 'getDisableReason')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
      await pruneWebhooks.pruneWebhooks(bot, [])
      expect(relevantFeeds[0].webhook.disabled).toBeUndefined()
      expect(relevantFeeds[0].save).toHaveBeenCalledTimes(1)
      expect(relevantFeeds[1].webhook.disabled).toBeUndefined()
      expect(relevantFeeds[1].save).toHaveBeenCalledTimes(1)
    })
  })
  describe('getRelevantFeeds', function () {
    it('excludes feeds with no webhooks', function () {
      const feeds = [{
        _id: 1,
        channel: 'a'
      }, {
        _id: 2,
        webhook: {},
        channel: 'b'
      }, {
        _id: 3,
        channel: 'c'
      }]
      bot.channels.cache.get
        .mockReturnValue({})
      const relevantFeeds = pruneWebhooks.getRelevantFeeds(bot, feeds)
      expect(relevantFeeds).toEqual([
        feeds[1]
      ])
    })
    it('excludes feeds with missing channel', function () {
      const feeds = [{
        _id: 1,
        webhook: {},
        channel: 'a'
      }, {
        _id: 2,
        webhook: {},
        channel: 'b'
      }, {
        _id: 3,
        webhook: {},
        channel: 'c'
      }]
      bot.channels.cache.get
        .mockReturnValueOnce({})
        .mockReturnValueOnce({})
        .mockReturnValueOnce()
      const relevantFeeds = pruneWebhooks.getRelevantFeeds(bot, feeds)
      expect(relevantFeeds).toEqual([
        feeds[0],
        feeds[1]
      ])
    })
  })
  describe('fetchChannelWebhooks', function () {
    it('fetches all webhooks', async function () {
      const relevantFeeds = [1, 2, 3]
      const channels = [{
        id: 7,
        fetchWebhooks: jest.fn().mockResolvedValue('abc')
      }, {
        id: 8,
        fetchWebhooks: jest.fn().mockResolvedValue('def')
      }, {
        id: 9,
        fetchWebhooks: jest.fn().mockResolvedValue('ghi')
      }]
      bot.channels.cache.get
        .mockReturnValueOnce(channels[0])
        .mockReturnValueOnce(channels[1])
        .mockReturnValueOnce(channels[2])
      const returned = await pruneWebhooks.fetchChannelWebhooks(bot, relevantFeeds)
      expect(returned.get(7)).toEqual(expect.objectContaining({
        value: 'abc'
      }))
      expect(returned.get(8)).toEqual(expect.objectContaining({
        value: 'def'
      }))
      expect(returned.get(9)).toEqual(expect.objectContaining({
        value: 'ghi'
      }))
    })
    it('returns a map', async function () {
      const relevantFeeds = [1]
      const channels = [{
        id: 7,
        fetchWebhooks: jest.fn().mockResolvedValue('abc')
      }]
      bot.channels.cache.get
        .mockReturnValueOnce(channels[0])
      const returned = await pruneWebhooks.fetchChannelWebhooks(bot, relevantFeeds)
      expect(returned).toBeInstanceOf(Map)
    })
    it('does not fetch the same channel multiple times', async function () {
      const relevantFeeds = [1, 2, 3]
      const channel = {
        id: 7,
        fetchWebhooks: jest.fn().mockResolvedValue('abc')
      }
      bot.channels.cache.get
        .mockReturnValue(channel)
      await pruneWebhooks.fetchChannelWebhooks(bot, relevantFeeds)
      expect(channel.fetchWebhooks).toHaveBeenCalledTimes(1)
    })
  })
  describe('getRemoveReason', function () {
    it('returns a populated string for missing webhook', async function () {
      const webhookID = 'qwte'
      const feed = {
        _id: 'abc',
        webhook: {
          id: webhookID
        }
      }
      const webhookFetchResult = {
        status: 'fulfilled',
        value: new Map()
      }
      const result = await pruneWebhooks.getRemoveReason(bot, feed, webhookFetchResult)
      expect(result).toEqual('Removing missing webhook from feed abc')
    })
    it('returns a populated string for unpermitted webhook', async function () {
      const webhookID = 'qwte'
      const feed = {
        _id: 'abc',
        webhook: {
          id: webhookID
        }
      }
      const webhookFetchResult = {
        status: 'rejected',
        reason: {
          code: 50013
        }
      }
      const result = await pruneWebhooks.getRemoveReason(bot, feed, webhookFetchResult)
      expect(result).toEqual('Removing unpermitted webhook from feed abc')
    })
    it('returns an empty string for valid webhook', async function () {
      const webhookID = 'qwte'
      const feed = {
        _id: 'abc',
        webhook: {
          id: webhookID
        }
      }
      const webhookFetchResult = {
        status: 'fulfilled',
        value: new Map([[webhookID, {}]])
      }
      const result = await pruneWebhooks.getRemoveReason(bot, feed, webhookFetchResult)
      expect(result).toEqual('')
    })
  })
  describe('getDisableReason', function () {
    it('returns empty string if authorized', async () => {
      Supporter.enabled = true
      const webhookID = 'qwte'
      const feed = {
        _id: 'abc',
        webhook: {
          id: webhookID
        }
      }
      bot.channels.cache.get.mockReturnValue({
        guild: {
          id: 'whatever'
        }
      })
      Guild.prototype.hasSupporterOrSubscriber.mockResolvedValue(true)
      const result = await pruneWebhooks.getDisableReason(bot, feed)
      expect(result).toEqual('')
    })
    it('returns the reason if unauthorized', async () => {
      Supporter.enabled = true
      const webhookID = 'qwte'
      const feed = {
        _id: 'abc',
        webhook: {
          id: webhookID
        }
      }
      bot.channels.cache.get.mockReturnValue({
        guild: {
          id: 'whatever'
        }
      })
      Guild.prototype.hasSupporterOrSubscriber.mockResolvedValue(false)
      const result = await pruneWebhooks.getDisableReason(bot, feed)
      expect(result).toEqual(`Disabling unauthorized supporter webhook from feed ${feed._id}`)
    })
    it('returns empty string if supporter is not enabled', async () => {
      Supporter.enabled = false
      const webhookID = 'qwte'
      const feed = {
        _id: 'abc',
        webhook: {
          id: webhookID
        }
      }
      bot.channels.cache.get.mockReturnValue({
        guild: {
          id: 'whatever'
        }
      })
      Guild.prototype.hasSupporterOrSubscriber.mockResolvedValue(false)
      const result = await pruneWebhooks.getDisableReason(bot, feed)
      expect(result).toEqual('')
    })
  })
})
