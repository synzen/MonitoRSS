process.env.TEST_ENV = true
const config = require('../../../config.js')
const Profile = require('../../../structs/db/Profile.js')
const Supporter = require('../../../structs/db/Supporter.js')

jest.mock('../../../structs/db/Supporter.js')
jest.mock('../../../config.js', () => ({
  get: () => ({
    feeds: {
      max: 22
    }
  })
}))

describe('Unit::structs/db/Profile', function () {
  afterEach(function () {
    jest.restoreAllMocks()
    Supporter.getValidSupporterOfGuild.mockReset()
  })
  describe('constructor', function () {
    it('throws an error if id is not set', function () {
      expect(() => new Profile({ name: 1 }))
        .toThrowError(new Error('Undefined _id'))
    })
    it('throws an error if name is not set', function () {
      expect(() => new Profile({ _id: 1 }))
        .toThrowError(new Error('Undefined name'))
    })
    it('does not throw with correct info', function () {
      expect(() => new Profile({ _id: 1, name: 1 }))
        .not.toThrowError()
    })
    it('sets defined values from arg', function () {
      const initialize = {
        _id: 1,
        name: 1,
        dateFormat: '123',
        dateLanguage: '452',
        locale: '2344',
        prefix: 'aws',
        timezone: 'as'
      }
      const profile = new Profile(initialize)
      for (const key in initialize) {
        expect(profile[key]).toEqual(initialize[key])
      }
      expect(profile.alert).toEqual([])
    })
  })
  describe('toObject', function () {
    it('returns a plain with the right keys', function () {
      const initialize = {
        _id: 1,
        name: 1,
        dateFormat: '123',
        dateLanguage: '452',
        locale: '2344',
        prefix: 'aws',
        timezone: 'as'
      }
      const profile = new Profile(initialize)
      const exported = profile.toObject()
      expect(Object.prototype.toString.call(exported)).toEqual('[object Object]')
      for (const key in initialize) {
        expect(exported[key]).toEqual(profile[key])
      }
    })
  })
  describe('getFeedLimit', function () {
    it('calls supporter get max feeds if supporter', async function () {
      const maxFeeds = 22
      const getMaxFeeds = jest.fn(() => maxFeeds)
      Supporter.getValidSupporterOfGuild.mockResolvedValue({ getMaxFeeds })
      const returned = await Profile.getFeedLimit()
      expect(Supporter.getValidSupporterOfGuild).toHaveBeenCalledTimes(1)
      expect(returned).toEqual(maxFeeds)
    })
    it('returns config max feeds if no supporter', async function () {
      Supporter.getValidSupporterOfGuild.mockResolvedValue(null)
      const returned = await Profile.getFeedLimit()
      expect(Supporter.getValidSupporterOfGuild).toHaveBeenCalledTimes(1)
      expect(returned).toEqual(config.get().feeds.max)
    })
  })
})
