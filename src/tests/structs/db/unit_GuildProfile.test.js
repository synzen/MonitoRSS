const GuildProfile = require('../../../structs/db/GuildProfile.js')

describe('Unit::GuildProfile', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  it('returns this._id as .id', function () {
    const _id = 1
    const profile = new GuildProfile({ _id, name: 'abc' })
    expect(profile.id).toEqual(_id)
  })
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
  describe('getFeeds', function () {
    it('throws an error if unsaved', function () {
      jest.spyOn(GuildProfile.prototype, 'isSaved').mockReturnValueOnce(false)
      const profile = new GuildProfile({ _id: 1, name: 'abc' })
      return expect(profile.getFeeds()).rejects.toThrowError(new Error('Must be saved before getting feeds'))
    })
  })
})
