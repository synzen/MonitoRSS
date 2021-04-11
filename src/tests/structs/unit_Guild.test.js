const Supporter = require('../../structs/db/Supporter.js')
const Guild = require('../../structs/Guild.js')
const GuildSubscription = require('../../structs/GuildSubscription.js')
const configuration = require('../../config')

jest.mock('../../config.js', () => ({
  get: jest.fn(() => ({
    _vipRefreshRateMinutes: 1234,
    feeds: {
      max: 100
    }
  }))
}))

describe('Unit::structs/Guild', function () {
  beforeEach(() => {
    jest.spyOn(Supporter, 'enabled', 'get').mockReturnValue(true)
  })
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('static getFastSupporterAndSubscriberGuildIds', () => {
    it('returns all guild IDs of valid supporters and subscriptions', async () => {
      jest.spyOn(Supporter, 'getValidFastGuilds').mockResolvedValue([
        'a',
        'b'
      ])
      jest.spyOn(GuildSubscription, 'getAllSubscriptions').mockResolvedValue([{
        guildId: 'c'
      }, {
        guildId: 'd'
      }, {
        guildId: 'a'
      }])
      const returned = await Guild.getFastSupporterAndSubscriberGuildIds()
      expect(returned).toBeInstanceOf(Set)
      expect(Array.from(returned)).toEqual(['a', 'b', 'c', 'd'])
    })
    it('does not include subscriptions with slow rates', async () => {
      jest.spyOn(Supporter, 'getValidFastGuilds').mockResolvedValue([
        'a',
        'b'
      ])
      jest.spyOn(GuildSubscription, 'getAllSubscriptions').mockResolvedValue([{
        guildId: 'c'
      }, {
        guildId: 'd',
        slowRate: true
      }, {
        guildId: 'a'
      }])
      const returned = await Guild.getFastSupporterAndSubscriberGuildIds()
      expect(returned).toBeInstanceOf(Set)
      expect(Array.from(returned)).toEqual(['a', 'b', 'c'])
    })
  })
  describe('static getAllUniqueFeedLimits', function () {
    it('returns guilds with their respsective supporter feed limits', async function () {
      const validSupporters = [{
        getMaxFeeds: () => 99,
        guilds: ['a', 'b']
      }, {
        getMaxFeeds: () => 11,
        guilds: ['c', 'd']
      }]
      jest.spyOn(GuildSubscription, 'getAllSubscriptions').mockResolvedValue([{
        guildId: 'e',
        maxFeeds: 12,
        refreshRate: 10,
        expireAt: new Date()
      }, {
        guildId: 'f',
        maxFeeds: 13,
        refreshRate: 10,
        expireAt: new Date()
      }])
      jest.spyOn(Supporter, 'getValidSupporters').mockResolvedValue(validSupporters)
      const returned = await Guild.getAllUniqueFeedLimits()
      expect(returned).toBeInstanceOf(Map)
      expect(Array.from(returned.keys())).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
      expect(returned.get('a')).toEqual(99)
      expect(returned.get('b')).toEqual(99)
      expect(returned.get('c')).toEqual(11)
      expect(returned.get('d')).toEqual(11)
      expect(returned.get('e')).toEqual(12)
      expect(returned.get('f')).toEqual(13)
    })
  })
  describe('getMaxFeeds', () => {
    let configMaxFeeds
    let guild
    beforeEach(() => {
      configMaxFeeds = configuration.get().feeds.max
      guild = new Guild('id')
      guild.getSupporter = jest.fn()
      guild.getSubscription = jest.fn()
    })
    describe('subscription exists but supporter does not', () => {
      it('returns subscription max feeds', async () => {
        const maxFeeds = configMaxFeeds + 100
        jest.spyOn(guild, 'getSubscription').mockResolvedValue({
          maxFeeds
        })
        await expect(guild.getMaxFeeds()).resolves.toEqual(maxFeeds)
      })
      it('returns the max of either subscription max feeds or default max feeds', async () => {
        const maxFeeds = configMaxFeeds - 100
        jest.spyOn(guild, 'getSubscription').mockResolvedValue({
          maxFeeds
        })
        await expect(guild.getMaxFeeds()).resolves.toEqual(configMaxFeeds)
      })
    })
    describe('subscription does not exist but supporter does', () => {
      beforeEach(() => {
        jest.spyOn(Guild.prototype, 'getSubscription').mockResolvedValue(null)
      })
      it('returns the supporter max feeds', async () => {
        const maxFeeds = configMaxFeeds + 100
        jest.spyOn(guild, 'getSupporter').mockResolvedValue({
          getMaxFeeds: async () => maxFeeds
        })
        await expect(guild.getMaxFeeds()).resolves.toEqual(maxFeeds)
      })
      it('returns the max of either supporter max feeds or default max feeds', async () => {
        const maxFeeds = configMaxFeeds - 100
        jest.spyOn(guild, 'getSupporter').mockResolvedValue({
          getMaxFeeds: async () => maxFeeds
        })
        await expect(guild.getMaxFeeds()).resolves.toEqual(configMaxFeeds)
      })
    })
    describe('subscription and supporter exists', () => {
      it('returns subscription max feeds if its greater than supporter and config', async () => {
        const supporterMaxFeeds = configMaxFeeds + 10
        const subscriptionMaxFeeds = configMaxFeeds + 100
        jest.spyOn(guild, 'getSubscription').mockResolvedValue({
          maxFeeds: subscriptionMaxFeeds
        })
        jest.spyOn(guild, 'getSupporter').mockResolvedValue({
          getMaxFeeds: async () => supporterMaxFeeds
        })
        await expect(guild.getMaxFeeds()).resolves.toEqual(subscriptionMaxFeeds)
      })
      it('returns supporter max feeds if its greater than subscription and config', async () => {
        const supporterMaxFeeds = configMaxFeeds + 100
        const subscriptionMaxFeeds = configMaxFeeds + 10
        jest.spyOn(Guild.prototype, 'getSubscription').mockResolvedValue({
          maxFeeds: subscriptionMaxFeeds
        })
        jest.spyOn(guild, 'getSupporter').mockResolvedValue({
          getMaxFeeds: async () => supporterMaxFeeds
        })
        await expect(guild.getMaxFeeds()).resolves.toEqual(supporterMaxFeeds)
      })
      it('returns config max feeds if its greater than subscription and supporter', async () => {
        const supporterMaxFeeds = configMaxFeeds - 10
        const subscriptionMaxFeeds = configMaxFeeds - 10
        jest.spyOn(Guild.prototype, 'getSubscription').mockResolvedValue({
          maxFeeds: subscriptionMaxFeeds
        })
        jest.spyOn(guild, 'getSupporter').mockResolvedValue({
          getMaxFeeds: async () => supporterMaxFeeds
        })
        await expect(guild.getMaxFeeds()).resolves.toEqual(configMaxFeeds)
      })
    })
  })
})
