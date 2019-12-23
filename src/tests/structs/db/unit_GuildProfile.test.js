const GuildProfile = require('../../../structs/db/GuildProfile.js')

describe('Unit::GuildProfile', function () {
  describe('constructor', function () {
    it('throws an error if id is not set', function () {
      expect(() => new GuildProfile({ name: 1 }))
        .toThrowError(new Error('Undefined _id'))
    })
    it('throws an error if name is not set', function () {
      expect(() => new GuildProfile({ _id: 1 }))
        .toThrowError(new Error('Undefined name'))
    })
    it('does not throw with correct info', function () {
      expect(() => new GuildProfile({ _id: 1, name: 1 }))
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
      const profile = new GuildProfile(initialize)
      for (const key in initialize) {
        expect(profile[key]).toEqual(initialize[key])
      }
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
      const profile = new GuildProfile(initialize)
      const exported = profile.toObject()
      expect(Object.prototype.toString.call(exported)).toEqual('[object Object]')
      for (const key in initialize) {
        expect(exported[key]).toEqual(profile[key])
      }
    })
  })
})
