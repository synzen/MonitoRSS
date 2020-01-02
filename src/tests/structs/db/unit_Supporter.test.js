process.env.TEST_ENV = true
const Supporter = require('../../../structs/db/Supporter.js')
const Patron = require('../../../structs/db/Patron.js')
const config = require('../../../config.js')

jest.mock('../../../config.js')

config.feeds.max = 444

describe('Unit::structs/db/Supporter', function () {
  const initData = {
    _id: '123'
  }
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('throws an error for missing _id', function () {
      const data = {
        patron: 12,
        webhook: true,
        maxGuilds: 1,
        maxFeeds: 1,
        guilds: [],
        expireAt: '3er',
        comment: '123',
        slowRate: true,
        discord: '3rte3y'
      }
      expect(() => new Supporter(data))
        .toThrow(new TypeError('_id is undefined'))
    })
    it(`does not throw errors for any values other than _id`, function () {
      const data = {
        _id: '123'
      }
      expect(() => new Supporter(data)).not.toThrow()
    })
    it(`initializes correctly`, function () {
      const supporter = new Supporter({ ...initData })
      expect(supporter.guilds).toEqual([])
    })
  })
  describe('static get compatible', function () {
    it('returns Patron.compatible', function () {
      const val = 'we346yr75tu'
      jest.spyOn(Patron, 'compatible', 'get').mockReturnValue(val)
      expect(Supporter.compatible).toEqual(val)
    })
  })
  describe('static get refreshRateMinutes', function () {
    it('returns Patron.refreshRateMinutes', function () {
      const val = 4444
      jest.spyOn(Patron, 'refreshRateMinutes', 'get').mockReturnValue(val)
      expect(Supporter.refreshRateMinutes).toEqual(val)
    })
  })
  describe('static getValidSupporters', function () {
    it('returns all guilds of all valid supporters in 1 array', async function () {
      const supporters = [{
        _id: 1,
        isValid: () => Promise.resolve(true)
      }, {
        _id: 2,
        isValid: () => Promise.resolve(false)
      }, {
        _id: 3,
        isValid: () => Promise.resolve(true)
      }, {
        _id: 4,
        isValid: () => Promise.resolve(true)
      }]
      jest.spyOn(Supporter, 'getAll').mockResolvedValue(supporters)
      const guilds = await Supporter.getValidSupporters()
      const expected = [supporters[0], supporters[2], supporters[3]]
      expect(guilds).toEqual(expected)
    })
  })
  describe('static getValidGuilds', function () {
    it('returns all guilds from valid supporters in 1 array', async function () {
      const validSupporters = [{
        guilds: [1, 2, 3]
      }, {
        guilds: []
      }, {
        guilds: [4, 5, 6]
      }]
      jest.spyOn(Supporter, 'getValidSupporters').mockResolvedValue(validSupporters)
      const returned = await Supporter.getValidGuilds()
      expect(returned).toEqual([1, 2, 3, 4, 5, 6])
    })
  })
  describe('static hasValidGuild', function () {
    it('returns whether valid guilds have the id', async function () {
      jest.spyOn(Supporter, 'getValidGuilds').mockResolvedValue(['a', 'b', 'c'])
      await expect(Supporter.hasValidGuild('b'))
        .resolves.toEqual(true)
      await expect(Supporter.hasValidGuild('z'))
        .resolves.toEqual(false)
    })
  })
  describe('getMaxGuilds', function () {
    it('returns the result from patron method if patron', async function () {
      const supporter = new Supporter({ ...initData })
      supporter.patron = true
      const maxGuilds = 5555
      const patron = {
        determineMaxGuilds: jest.fn(() => maxGuilds)
      }
      const spy = jest.spyOn(Patron, 'getBy').mockResolvedValue(patron)
      const returned = await supporter.getMaxGuilds()
      expect(spy).toHaveBeenCalledWith('discord', initData._id)
      expect(returned).toEqual(maxGuilds)
    })
    it('returns 1 if maxGuilds is undefined, or maxGuilds if defined', async function () {
      const supporter = new Supporter({ ...initData })
      const maxGuilds = 999
      supporter.patron = false
      supporter.maxGuilds = 999
      await expect(supporter.getMaxGuilds()).resolves.toEqual(maxGuilds)
      supporter.maxGuilds = undefined
      await expect(supporter.getMaxGuilds()).resolves.toEqual(1)
    })
  })
  describe('getMaxFeeds', function () {
    it('returns result from patron determineMaxFeeds if patron', async function () {
      const supporter = new Supporter({ ...initData })
      supporter.patron = true
      const maxFeeds = 1231
      const patron = {
        determineMaxFeeds: jest.fn(() => maxFeeds)
      }
      const spy = jest.spyOn(Patron, 'getBy').mockResolvedValue(patron)
      const returned = await supporter.getMaxFeeds()
      expect(spy).toHaveBeenCalledWith('discord', initData._id)
      expect(returned).toEqual(maxFeeds)
    })
    describe('not a patron', function () {
      it('returns the default config max feeds if no maxFeeds set', async function () {
        const supporter = new Supporter({ ...initData })
        supporter.patron = false
        supporter.maxFeeds = undefined
        await expect(supporter.getMaxFeeds())
          .resolves.toEqual(config.feeds.max)
      })
      it('returns the default config max feeds if it is bigger than maxFeeds', async function () {
        const supporter = new Supporter({ ...initData })
        supporter.patron = false
        supporter.maxFeeds = config.feeds.max - 1
        await expect(supporter.getMaxFeeds())
          .resolves.toEqual(config.feeds.max)
      })
      it('returns maxFeeds if bigger than default config max feeds', async function () {
        const supporter = new Supporter({ ...initData })
        supporter.patron = false
        supporter.maxFeeds = config.feeds.max + 1
        await expect(supporter.getMaxFeeds())
          .resolves.toEqual(supporter.maxFeeds)
      })
    })
  })
  describe('getWebhookAccess', function () {
    it('returns the patron determineWebhook return value if patron', async function () {
      const supporter = new Supporter({ ...initData })
      supporter.patron = true
      const patron = {
        determineWebhook: jest.fn(() => 5553)
      }
      const spy = jest.spyOn(Patron, 'getBy').mockResolvedValue(patron)
      const returned = await supporter.getWebhookAccess()
      expect(spy).toHaveBeenCalledWith('discord', initData._id)
      expect(returned).toEqual(5553)
    })
    it('returns this.webhook if not a patron', async function () {
      const supporter = new Supporter({ ...initData })
      const value = 'booadg'
      supporter.patron = false
      supporter.webhook = value
      const returned = await supporter.getWebhookAccess()
      expect(returned).toEqual(value)
    })
  })
  describe('toObject', function () {
    it('returns correctly', function () {
      const data = {
        _id: 'abc',
        patron: 'q3et',
        webhook: true,
        guilds: [1, 2, 3],
        expireAt: 'abc',
        comment: '123',
        slowRate: true,
        maxGuilds: 435,
        maxFeeds: 23
      }
      const supporter = new Supporter({ ...data })
      expect(supporter.toObject()).toEqual(data)
    })
  })
  describe('isValid', function () {
    describe('is patron', function () {
      it('returns isActive() method call on patron if exists', async function () {
        const supporter = new Supporter({ ...initData })
        supporter.patron = 'abc'
        const isActive = jest.fn(() => 1234)
        const patron = {
          isActive
        }
        jest.spyOn(Patron, 'getBy').mockResolvedValue(patron)
        await expect(supporter.isValid()).resolves.toEqual(1234)
        expect(isActive).toHaveBeenCalled()
      })
      it('returns false if no patron found', async function () {
        const supporter = new Supporter({ ...initData })
        supporter.patron = 'abc'
        jest.spyOn(Patron, 'getBy').mockResolvedValue(null)
        await expect(supporter.isValid()).resolves.toEqual(false)
      })
    })
    describe('is not patron', function () {
      it('returns true if there is no expireAt', async function () {
        const supporter = new Supporter({ ...initData })
        supporter.expireAt = undefined
        await expect(supporter.isValid()).resolves.toEqual(true)
      })
      it('returns false if expireAt is before now', async function () {
        const supporter = new Supporter({ ...initData })
        const longAgo = new Date()
        longAgo.setDate(longAgo.getDate() - 1)
        supporter.expireAt = longAgo.toString()
        await expect(supporter.isValid()).resolves.toEqual(false)
      })
      it('returns false if expireAt is after now', async function () {
        const supporter = new Supporter({ ...initData })
        const longAgo = new Date()
        longAgo.setDate(longAgo.getDate() + 1)
        supporter.expireAt = longAgo.toString()
        await expect(supporter.isValid()).resolves.toEqual(true)
      })
    })
  })
})
