process.env.TEST_ENV = true
const Subscriber = require('../../structs/db/Subscriber.js')
const pruneSubscribers = require('../../maintenance/pruneSubscribers.js')

jest.mock('../../structs/db/Subscriber.js')

Subscriber.TYPES = {
  USER: 'user',
  ROLE: 'role'
}

describe('Unit::maintenance/pruneSubscribers', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  afterEach(function () {
    Subscriber.getAll.mockReset()
  })
  it('skips subscribers whose feed does not exist', async function () {
    const subscribers = [{
      id: 'id1',
      type: 'user',
      feed: 'feedA',
      delete: jest.fn()
    }, {
      id: 'id2',
      type: 'role',
      feed: 'feedA',
      delete: jest.fn()
    }, {
      id: 'id3',
      type: 'user',
      feed: 'feedB',
      delete: jest.fn()
    }]
    const feeds = [{
      _id: 'feedB',
      guild: 'guildA'
    }]
    const bot = {
      shard: {
        ids: []
      },
      guilds: {
        cache: new Map([['guildA', {
          members: {
            fetch: async () => ({})
          },
          roles: {
            fetch: async () => ({})
          }
        }]])
      },
      users: {
        fetch: async () => true
      }
    }
    Subscriber.getAll.mockResolvedValue(subscribers)
    await pruneSubscribers.pruneSubscribers(bot, feeds)
    expect(subscribers[0].delete).not.toHaveBeenCalled()
    expect(subscribers[1].delete).not.toHaveBeenCalled()
    expect(subscribers[2].delete).not.toHaveBeenCalled()
  })
  describe('feed exists', function () {
    it('deletes subscribers if their type is invalid', async function () {
      const subscribers = [{
        id: 'u1',
        type: 'qwt4ry3e5',
        feed: 'feedA',
        delete: jest.fn()
      }, {
        id: 'u2',
        type: 'qwt4ry3e5',
        feed: 'feedA',
        delete: jest.fn()
      }]
      const feeds = [{
        _id: 'feedA',
        guild: 'guildA'
      }]
      const bot = {
        shard: {
          ids: []
        },
        guilds: {
          cache: new Map([['guildA', {
            members: {
              fetch: jest.fn()
            }
          }]])
        }
      }
      Subscriber.getAll.mockResolvedValue(subscribers)
      await pruneSubscribers.pruneSubscribers(bot, feeds)
      expect(subscribers[0].delete).toHaveBeenCalledTimes(1)
      expect(subscribers[1].delete).toHaveBeenCalledTimes(1)
    })
    it('does not fetch members of the same ID twice', async function () {
      const subscribers = [{
        id: 'u1',
        type: Subscriber.TYPES.USER,
        feed: 'feedA',
        delete: jest.fn()
      }, {
        id: 'u1',
        type: Subscriber.TYPES.USER,
        feed: 'feedB',
        delete: jest.fn()
      }]
      const feeds = [{
        _id: 'feedA',
        guild: 'guildA'
      }, {
        _id: 'feedB',
        guild: 'guildA'
      }]
      const guildAMembersFetch = jest.fn()
      const bot = {
        shard: {
          ids: []
        },
        guilds: {
          cache: new Map([
            ['guildA', {
              members: {
                fetch: guildAMembersFetch
              }
            }]
          ])
        }
      }
      Subscriber.getAll.mockResolvedValue(subscribers)
      await pruneSubscribers.pruneSubscribers(bot, feeds)
      expect(guildAMembersFetch).toHaveBeenCalledTimes(1)
      expect(guildAMembersFetch).toHaveBeenCalledWith(subscribers[0].id)
    })
    it('prunes user if they do not exist in bot', async function () {
      const subscribers = [{
        id: 'u1',
        type: Subscriber.TYPES.USER,
        feed: 'feedA',
        delete: jest.fn()
      }, {
        id: 'u2',
        type: Subscriber.TYPES.USER,
        feed: 'feedA',
        delete: jest.fn()
      }]
      const feeds = [{
        _id: 'feedA',
        guild: 'guildA'
      }]
      const fetchError = {
        code: 10013
      }
      const bot = {
        shard: {
          ids: []
        },
        guilds: {
          cache: new Map([['guildA', {
            members: {
              fetch: jest.fn().mockImplementation(async (id) => {
                if (id === subscribers[0].id) {
                  return {}
                } else {
                  throw fetchError
                }
              })
            }
          }]])
        }
      }
      Subscriber.getAll.mockResolvedValue(subscribers)
      await pruneSubscribers.pruneSubscribers(bot, feeds)
      expect(subscribers[0].delete).not.toHaveBeenCalled()
      expect(subscribers[1].delete).toHaveBeenCalled()
    })
    it('prunes roles if they are not in guild that exists in bot', async function () {
      const subscribers = [{
        id: 'rsub1',
        type: Subscriber.TYPES.ROLE,
        feed: 'feedA',
        delete: jest.fn()
      }, {
        id: 'rsub12',
        type: Subscriber.TYPES.ROLE,
        feed: 'feedA',
        delete: jest.fn()
      }]
      const feeds = [{
        _id: 'feedA',
        guild: 'guildA'
      }]
      const guildA = {
        roles: {
          cache: {
            has: (id) => id === subscribers[0].id
          }
        }
      }
      const bot = {
        shard: {
          ids: []
        },
        guilds: {
          cache: new Map([['guildA', guildA]])
        }
      }
      Subscriber.getAll.mockResolvedValue(subscribers)
      await pruneSubscribers.pruneSubscribers(bot, feeds)
      expect(subscribers[0].delete).not.toHaveBeenCalled()
      expect(subscribers[1].delete).toHaveBeenCalled()
    })
    it('prunes roles and users if they both do not exist', async function () {
      const subscribers = [{
        id: 'rsub1',
        type: Subscriber.TYPES.ROLE,
        feed: 'feedA',
        delete: jest.fn()
      }, {
        id: 'usub12',
        type: Subscriber.TYPES.USER,
        feed: 'feedA',
        delete: jest.fn()
      }]
      const feeds = [{
        _id: 'feedA',
        guild: 'guildA'
      }]
      const memberFetchError = {
        code: 10013
      }
      const guildA = {
        members: {
          fetch: jest.fn()
            .mockRejectedValue(memberFetchError)
        },
        roles: {
          cache: {
            has: () => false
          }
        }
      }
      const bot = {
        shard: {
          ids: []
        },
        guilds: {
          cache: new Map([['guildA', guildA]])
        }
      }
      Subscriber.getAll.mockResolvedValue(subscribers)
      await pruneSubscribers.pruneSubscribers(bot, feeds)
      expect(subscribers[1].delete).toHaveBeenCalled()
      expect(subscribers[0].delete).toHaveBeenCalled()
    })
    it('handles member error codes correctly', async function () {
      const subscribers = [{
        id: 'u1',
        type: Subscriber.TYPES.USER,
        feed: 'feedA',
        delete: jest.fn()
      }, {
        id: 'u2',
        type: Subscriber.TYPES.USER,
        feed: 'feedA',
        delete: jest.fn()
      }]
      const feeds = [{
        _id: 'feedA',
        guild: 'guildA'
      }]
      const fetchErrorOne = {
        code: 10013
      }
      const fetchErrorTwo = {
        code: 10007
      }
      const bot = {
        shard: {
          ids: []
        },
        guilds: {
          cache: new Map([['guildA', {
            members: {
              fetch: jest.fn()
                .mockImplementation(async (id) => {
                  if (id === subscribers[0].id) {
                    throw fetchErrorOne
                  } else if (id === subscribers[1].id) {
                    throw fetchErrorTwo
                  }
                })
            }
          }]])

        }
      }
      Subscriber.getAll.mockResolvedValue(subscribers)
      await pruneSubscribers.pruneSubscribers(bot, feeds)
      expect(subscribers[1].delete).toHaveBeenCalled()
      expect(subscribers[0].delete).toHaveBeenCalled()
    })
  })
})
