process.env.TEST_ENV = true
const Profile = require('../../structs/db/Profile.js')
const pruneProfileAlerts = require('../../maintenance/pruneProfileAlerts.js')

jest.mock('../../structs/db/Profile.js')

describe('Unit::maintenance/pruneProfileAlerts', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
    Profile.mockReset()
  })
  it('deletes non-number IDs', async function () {
    const profiles = [{
      alert: ['a', '123'],
      save: jest.fn()
    }, {
      alert: ['b'],
      save: jest.fn()
    }]
    const bot = {
      shard: {
        ids: []
      },
      guilds: {
        cache: {
          get: jest.fn(() => ({
            members: {
              fetch: jest.fn(() => ({}))
            }
          }))
        }
      }
    }
    Profile.getAll.mockResolvedValue(profiles)
    await pruneProfileAlerts(bot)
    expect(profiles[0].alert).toEqual(['123'])
    expect(profiles[1].alert).toEqual([])
    expect(profiles[0].save).toHaveBeenCalled()
    expect(profiles[1].save).toHaveBeenCalled()
  })
  it('does not call save on unchanged profiles', async function () {
    const profiles = [{
      alert: [],
      save: jest.fn()
    }, {
      alert: [],
      save: jest.fn()
    }]
    const bot = {
      shard: {
        ids: []
      },
      guilds: {
        cache: {
          get: jest.fn(() => ({
            members: {
              fetch: jest.fn(() => ({}))
            }
          }))
        }
      }
    }
    Profile.getAll.mockResolvedValue(profiles)
    await pruneProfileAlerts(bot)
    expect(profiles[0].save).not.toHaveBeenCalled()
    expect(profiles[1].save).not.toHaveBeenCalled()
  })
  it('deletes unknown members', async function () {
    const profiles = [{
      alert: ['1', '2', '3'],
      save: jest.fn()
    }, {
      alert: ['4'],
      save: jest.fn()
    }]
    const bot = {
      shard: {
        ids: []
      },
      guilds: {
        cache: {
          get: jest.fn()
            .mockReturnValueOnce({
              members: {
                fetch: jest.fn()
                  .mockResolvedValueOnce({})
                  .mockResolvedValueOnce({})
                  .mockRejectedValueOnce({ code: 10007 })
              }
            })
            .mockReturnValueOnce({
              members: {
                fetch: jest.fn()
                  .mockRejectedValueOnce({ code: 10007 })
              }
            })
        }
      }
    }
    Profile.getAll.mockResolvedValue(profiles)
    await pruneProfileAlerts(bot)
    expect(profiles[0].alert).toEqual(['2', '3'])
    expect(profiles[0].save).toHaveBeenCalled()
    expect(profiles[1].save).toHaveBeenCalled()
  })
  it('works on relevant error codes', async function () {
    const profiles = [{
      alert: ['1', '2', '3'],
      save: jest.fn()
    }]
    const bot = {
      shard: {
        ids: []
      },
      guilds: {
        cache: {
          get: jest.fn()
            .mockReturnValueOnce({
              members: {
                fetch: jest.fn()
                  .mockRejectedValueOnce({ code: 50035 })
                  .mockRejectedValueOnce({ code: 10013 })
                  .mockRejectedValueOnce({ code: 10007 })
              }
            })
        }
      }
    }
    Profile.getAll.mockResolvedValue(profiles)
    await pruneProfileAlerts(bot)
    expect(profiles[0].alert).toEqual([])
    expect(profiles[0].save).toHaveBeenCalled()
  })
  it('throws on unknown error', async function () {
    const profiles = [{
      alert: ['1'],
      save: jest.fn()
    }]
    const error = new Error('hsedg')
    const bot = {
      shard: {
        ids: []
      },
      guilds: {
        cache: {
          get: jest.fn()
            .mockReturnValueOnce({
              members: {
                fetch: jest.fn()
                  .mockRejectedValue(error)
              }
            })
        }
      }
    }
    Profile.getAll.mockResolvedValue(profiles)
    await expect(pruneProfileAlerts(bot))
      .rejects.toThrow(error)
    expect(profiles[0].alert).toEqual(['1'])
    expect(profiles[0].save).not.toHaveBeenCalled()
  })
  it('rejects when profile get all fails', async function () {
    const error = new Error('wsetg')
    Profile.getAll.mockRejectedValue(error)
    const bot = {
      shard: {
        ids: []
      }
    }
    await expect(pruneProfileAlerts(bot))
      .rejects.toThrow(error)
  })
})
