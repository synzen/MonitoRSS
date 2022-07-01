process.env.TEST_ENV = true
const Profile = require('../../../structs/db/Profile.js')
const Supporter = require('../../../structs/db/Supporter.js')

jest.mock('../../../structs/db/Supporter.js')
jest.mock('../../../config.js', () => ({
  get: () => ({
    bot: {
      prefix: 'sdf'
    },
    feeds: {
      max: 22
    }
  })
}))

describe('Unit::structs/db/Profile', function () {
  const necessaryInit = {
    _id: 'sr',
    name: 'sedg'
  }
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
  describe('static setPrefix', function () {
    afterEach(function () {
      Profile.prefixes = new Map()
    })
    it('sets the new prefix', function () {
      const guildID = 'qwt4ery'
      const prefix = 'w4rye5t'
      Profile.setPrefix(guildID, prefix)
      expect(Profile.prefixes.get(guildID))
        .toEqual(prefix)
    })
  })
  describe('static getPrefix', function () {
    afterEach(function () {
      Profile.prefixes = new Map()
    })
    it('gets the prefix', function () {
      const guildID = 'qwt4ery'
      const prefix = 'w4rye5t'
      Profile.prefixes.set(guildID, prefix)
      expect(Profile.getPrefix(guildID))
        .toEqual(prefix)
    })
  })
  describe('static populatePrefixes', function () {
    it('populates properly', async function () {
      const profiles = [{
        _id: 1,
        prefix: 'a'
      }, {
        _id: 2
      }, {
        _id: 3,
        prefix: 'b'
      }]
      jest.spyOn(Profile, 'getAll')
        .mockResolvedValue(profiles)
      const setPrefix = jest.spyOn(Profile, 'setPrefix')
        .mockImplementation()
      await Profile.populatePrefixes()
      expect(setPrefix).toHaveBeenCalledWith(profiles[0]._id, profiles[0].prefix)
      expect(setPrefix).not.toHaveBeenCalledWith(profiles[1]._id, profiles[1].prefix)
      expect(setPrefix).toHaveBeenCalledWith(profiles[2]._id, profiles[2].prefix)
    })
    it('clears prefixes', async function () {
      Profile.prefixes = new Map([['1', '2'], ['3', '4']])
      jest.spyOn(Profile, 'getAll')
        .mockResolvedValue([])
      jest.spyOn(Profile, 'setPrefix')
        .mockImplementation()
      await Profile.populatePrefixes()
      expect(Profile.prefixes.size).toEqual(0)
    })
  })
  describe('setPrefixAndSave', function () {
    it('saves', async function () {
      const prefix = 'qa3et4wr'
      const profile = new Profile({ ...necessaryInit })
      const save = jest.spyOn(profile, 'save')
        .mockImplementation()
      await profile.setPrefixAndSave(prefix)
      expect(save).toHaveBeenCalledTimes(1)
    })
    it('sets the prefix', async function () {
      const prefix = 'qa3et4wr'
      const profile = new Profile({ ...necessaryInit })
      jest.spyOn(profile, 'save')
        .mockImplementation()
      await profile.setPrefixAndSave(prefix)
      expect(profile.prefix).toEqual(prefix)
    })
    it('updates the cache', async function () {
      const prefix = 'qa3et4wr'
      const profileID = 'w4rey57tu6'
      const profile = new Profile({ ...necessaryInit })
      profile._id = profileID
      const setPrefix = jest.spyOn(Profile, 'setPrefix')
        .mockImplementation()
      jest.spyOn(profile, 'save')
        .mockImplementation()
      await profile.setPrefixAndSave(prefix)
      expect(setPrefix).toHaveBeenCalledWith(profileID, prefix)
    })
    it('deletes from cache if undefined', async function () {
      const prefix = undefined
      const profileID = 'w4rey57tu6'
      const profile = new Profile({ ...necessaryInit })
      profile._id = profileID
      const deletePrefix = jest.spyOn(Profile, 'deletePrefix')
        .mockImplementation()
      jest.spyOn(profile, 'save')
        .mockImplementation()
      await profile.setPrefixAndSave(prefix)
      expect(deletePrefix).toHaveBeenCalledWith(profileID)
    })
  })
})
