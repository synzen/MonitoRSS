process.env.TEST_ENV = true
const Profile = require('../../structs/db/Profile.js')
const pruneProfiles = require('../../maintenance/pruneProfiles.js')

jest.mock('../../structs/db/Profile.js')

describe('Unit::maintenance/pruneProfiles', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  it('deletes the guilds that are not in guildIds', async function () {
    const profiles = [{
      _id: 'a',
      delete: jest.fn()
    }, {
      _id: 'b',
      delete: jest.fn()
    }, {
      _id: 'foo',
      delete: jest.fn()
    }, {
      _id: 'c',
      delete: jest.fn()
    }]
    const guildIds = new Map([['a', 0], ['c', 2], ['z', 1]])
    Profile.getAll.mockResolvedValue(profiles)
    await pruneProfiles(guildIds)
    expect(profiles[0].delete).not.toHaveBeenCalled()
    expect(profiles[1].delete).toHaveBeenCalledTimes(1)
    expect(profiles[2].delete).toHaveBeenCalledTimes(1)
    expect(profiles[3].delete).not.toHaveBeenCalled()
  })
  it('returns the number of deleted guilds', async function () {
    const profiles = [{
      _id: 'a',
      delete: jest.fn()
    }, {
      _id: 'b',
      delete: jest.fn()
    }, {
      _id: 'foo',
      delete: jest.fn()
    }, {
      _id: 'c',
      delete: jest.fn()
    }]
    const guildIds = new Map([['a', 0], ['c', 1], ['f', 2]])
    Profile.getAll.mockResolvedValue(profiles)
    const result = await pruneProfiles(guildIds)
    expect(result).toEqual(2)
  })
})
