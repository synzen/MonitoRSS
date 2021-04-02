const Supporter = require('../../structs/db/Supporter.js')
const Guild = require('../../structs/Guild.js')
const GuildSubscription = require('../../structs/GuildSubscription.js')
const getConfig = require('../../config').get

jest.mock('../../config.js', () => ({
  get: jest.fn(() => ({
    _vipRefreshRateMinutes: 1234,
    feeds: {
      max: 100
    }
  }))
}))

describe('Unit::structs/GuildSubscription', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('static mapApiResponse', () => {
    it('returns correctly', () => {
      const config = getConfig()
      const response = {
        guild_id: 'abc',
        extra_feeds: 100,
        refresh_rate: 111,
        expire_at: new Date('2029-09-09')
      }
      expect(GuildSubscription.mapApiResponse(response)).toEqual({
        guildId: response.guild_id,
        maxFeeds: config.feeds.max + response.extra_feeds,
        refreshRate: response.refresh_rate / 60,
        expireAt: response.expire_at
      })
    })
  })
})
