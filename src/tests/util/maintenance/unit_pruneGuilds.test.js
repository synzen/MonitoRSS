process.env.TEST_ENV = true
const GuildProfile = require('../../../structs/db/GuildProfile.js')
const pruneGuilds = require('../../../util/maintenance/pruneGuilds.js')

jest.mock('../../../structs/db/GuildProfile.js')

describe('utils/maintenance/pruneGuilds', function () {
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
    GuildProfile.getAll.mockResolvedValue(profiles)
    await pruneGuilds(guildIds)
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
    GuildProfile.getAll.mockResolvedValue(profiles)
    const result = await pruneGuilds(guildIds)
    expect(result).toEqual(2)
  })
})
