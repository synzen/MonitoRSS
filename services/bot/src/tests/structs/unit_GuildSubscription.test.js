const GuildSubscription = require('../../structs/GuildSubscription.js')
const getConfig = require('../../config').get
const fetch = require('node-fetch')

jest.mock('../../config.js', () => ({
  get: jest.fn(() => ({
    _vipRefreshRateMinutes: 1234,
    feeds: {
      max: 100,
      refreshRateMinutes: 10
    }
  }))
}))

jest.mock('node-fetch')

describe('Unit::structs/GuildSubscription', function () {
  let mockResponse
  let apiConfig
  beforeEach(() => {
    mockResponse = {
      guild_id: 'abc',
      extra_feeds: 100,
      refresh_rate: 111,
      expire_at: new Date('2029-09-09')
    }
    apiConfig = {
      url: 'https://www.google.com',
      accessToken: 'accesstoken',
      enabled: true
    }
  })
  afterEach(function () {
    jest.restoreAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  describe('static mapApiResponse', () => {
    it('returns correctly', () => {
      const config = getConfig()
      expect(GuildSubscription.mapApiResponse(mockResponse)).toEqual({
        guildId: mockResponse.guild_id,
        maxFeeds: config.feeds.max + mockResponse.extra_feeds,
        refreshRate: mockResponse.refresh_rate / 60,
        expireAt: mockResponse.expire_at,
        slowRate: false
      })
    })
    it('returns slow rate if ignore refresh rate is true', () => {
      const config = getConfig()
      mockResponse = {
        guild_id: 'abc',
        extra_feeds: 100,
        refresh_rate: 111,
        expire_at: new Date('2029-09-09'),
        ignore_refresh_rate_benefit: true
      }
      expect(GuildSubscription.mapApiResponse(mockResponse)).toEqual({
        guildId: mockResponse.guild_id,
        maxFeeds: config.feeds.max + mockResponse.extra_feeds,
        refreshRate: mockResponse.refresh_rate / 60,
        expireAt: mockResponse.expire_at,
        slowRate: true
      })
    })
    it('returns slow rate if response refresh rate is slower than config', () => {
      const config = getConfig()
      mockResponse = {
        guild_id: 'abc',
        extra_feeds: 100,
        refresh_rate: config.feeds.refreshRateMinutes * 60 + 10,
        expire_at: new Date('2029-09-09')
      }
      expect(GuildSubscription.mapApiResponse(mockResponse)).toEqual({
        guildId: mockResponse.guild_id,
        maxFeeds: config.feeds.max + mockResponse.extra_feeds,
        refreshRate: mockResponse.refresh_rate / 60,
        expireAt: mockResponse.expire_at,
        slowRate: true
      })
    })
    it('does not return slow rate if response refresh rate is faster than config', () => {
      const config = getConfig()
      mockResponse = {
        guild_id: 'abc',
        extra_feeds: 100,
        refresh_rate: config.feeds.refreshRateMinutes * 60 / 2,
        expire_at: new Date('2029-09-09'),
        ignore_refresh_rate_benefit: false
      }
      expect(GuildSubscription.mapApiResponse(mockResponse)).toEqual({
        guildId: mockResponse.guild_id,
        maxFeeds: config.feeds.max + mockResponse.extra_feeds,
        refreshRate: mockResponse.refresh_rate / 60,
        expireAt: mockResponse.expire_at,
        slowRate: false
      })
    })
  })
  describe('static getSubscription', () => {
    it('returns null if url is not configured', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue({})
      await expect(GuildSubscription.getSubscription()).resolves.toEqual(null)
    })
    it('returns null if 404', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue(apiConfig)
      fetch.mockResolvedValue({
        status: 404,
        json: jest.fn()
      })
      await expect(GuildSubscription.getSubscription()).resolves.toEqual(null)
    })
    it('returns null if an error was thrown', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue(apiConfig)
      const error = new Error('asdsdf')
      fetch.mockRejectedValue(error)
      await expect(GuildSubscription.getSubscription()).resolves.toEqual(null)
    })
    it('returns null if disabled', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue({
        ...apiConfig,
        enabled: false
      })
      const error = new Error('asdsdf')
      fetch.mockRejectedValue(error)
      await expect(GuildSubscription.getSubscription()).resolves.toEqual(null)
    })
    it('returns a GuildSubscription on success', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue(apiConfig)
      fetch.mockResolvedValue({
        status: 200,
        json: async () => mockResponse
      })
      await expect(GuildSubscription.getSubscription()).resolves.toBeInstanceOf(GuildSubscription)
    })
    it('calls the right url and options', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue(apiConfig)
      fetch.mockResolvedValue({
        status: 200,
        json: async () => mockResponse
      })
      const guildId = '12345'
      await GuildSubscription.getSubscription(guildId)
      expect(fetch).toHaveBeenCalledWith(`${apiConfig.url}/guilds/${guildId}`, {
        headers: {
          Authorization: apiConfig.accessToken
        }
      })
    })
  })
  describe('static getAllSubscriptions', () => {
    it('returns empty array if url is not configured', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue({})
      await expect(GuildSubscription.getAllSubscriptions()).resolves.toEqual([])
    })
    it('returns empty array if an error ocurred', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue(apiConfig)
      const error = new Error('fetch err')
      fetch.mockRejectedValue(error)
      await expect(GuildSubscription.getAllSubscriptions()).resolves.toEqual([])
    })
    it('returns empty array if disabled', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue({
        ...apiConfig,
        enabled: false
      })
      const error = new Error('asdsdf')
      fetch.mockRejectedValue(error)
      await expect(GuildSubscription.getAllSubscriptions()).resolves.toEqual([])
    })
    it('returns guild subscriptions if successful', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue(apiConfig)
      fetch.mockResolvedValue({
        status: 200,
        json: () => [mockResponse, mockResponse]
      })
      const returned = await GuildSubscription.getAllSubscriptions()
      expect(returned).toHaveLength(2)
      expect(returned.every(item => item instanceof GuildSubscription)).toEqual(true)
    })
    it('calls the right url and options', async () => {
      jest.spyOn(GuildSubscription, 'getApiConfig').mockReturnValue(apiConfig)
      fetch.mockResolvedValue({
        status: 200,
        json: async () => [mockResponse]
      })
      await GuildSubscription.getAllSubscriptions()
      expect(fetch).toHaveBeenCalledWith(`${apiConfig.url}/guilds`, {
        headers: {
          Authorization: apiConfig.accessToken
        }
      })
    })
  })
})
