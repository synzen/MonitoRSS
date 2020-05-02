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
  it('deletes subscribers whose feed does not exist', async function () {
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
        cache: new Map([['guildA', {}]])
      },
      users: {
        fetch: async () => true
      }
    }
    Subscriber.getAll.mockResolvedValue(subscribers)
    await pruneSubscribers(bot, feeds)
    expect(subscribers[0].delete).toHaveBeenCalled()
    expect(subscribers[1].delete).toHaveBeenCalled()
    expect(subscribers[2].delete).not.toHaveBeenCalled()
  })
  describe('feed exists', function () {
    describe('sharded bot', function () {
      it('doesn\'t prune subscribers whose guilds are not within the bot', async function () {
        const subscribers = [{
          type: 'user',
          feed: 'feedA',
          delete: jest.fn()
        }, {
          type: 'role',
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
            cache: new Map([['guildB']])
          }
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        await pruneSubscribers(bot, feeds)
        expect(subscribers[0].delete).not.toHaveBeenCalled()
        expect(subscribers[1].delete).not.toHaveBeenCalled()
      })
      it('prunes user if they do not exist in bot', async function () {
        const subscribers = [{
          id: 'u1',
          type: 'user',
          feed: 'feedA',
          delete: jest.fn()
        }, {
          id: 'u2',
          type: 'user',
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
                fetch: jest.fn()
                  .mockRejectedValueOnce(fetchError)
                  .mockResolvedValueOnce()
              }
            }]])

          }
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        await pruneSubscribers(bot, feeds)
        expect(subscribers[0].delete).not.toHaveBeenCalled()
        expect(subscribers[1].delete).toHaveBeenCalled()
      })
      it('prunes roles if they are not in guild that exists in bot', async function () {
        const subscribers = [{
          id: 'rsub1',
          type: 'role',
          feed: 'feedA',
          delete: jest.fn()
        }, {
          id: 'rsub12',
          type: 'role',
          feed: 'feedA',
          delete: jest.fn()
        }]
        const feeds = [{
          _id: 'feedA',
          guild: 'guildA'
        }]
        const fetchError = {
          code: 10011
        }
        const guildA = {
          roles: {
            fetch: jest.fn()
              .mockRejectedValueOnce(fetchError)
              .mockResolvedValueOnce()
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
        await pruneSubscribers(bot, feeds)
        expect(subscribers[0].delete).not.toHaveBeenCalled()
        expect(subscribers[1].delete).toHaveBeenCalled()
      })
      it('prunes roles and users if they both do not exist', async function () {
        const subscribers = [{
          id: 'rsub1',
          type: 'role',
          feed: 'feedA',
          delete: jest.fn()
        }, {
          id: 'usub12',
          type: 'user',
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
        const roleFetchError = {
          code: 10011
        }
        const guildA = {
          members: {
            fetch: jest.fn()
              .mockRejectedValue(memberFetchError)
          },
          roles: {
            fetch: jest.fn()
              .mockRejectedValue(roleFetchError)
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
        await pruneSubscribers(bot, feeds)
        expect(subscribers[1].delete).toHaveBeenCalled()
        expect(subscribers[0].delete).toHaveBeenCalled()
      })
      it('handles member error codes correctly', async function () {
        const subscribers = [{
          id: 'u1',
          type: 'user',
          feed: 'feedA',
          delete: jest.fn()
        }, {
          id: 'u2',
          type: 'user',
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
                  .mockRejectedValueOnce(fetchErrorOne)
                  .mockRejectedValueOnce(fetchErrorTwo)
              }
            }]])

          }
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        await pruneSubscribers(bot, feeds)
        expect(subscribers[1].delete).toHaveBeenCalled()
        expect(subscribers[0].delete).toHaveBeenCalled()
      })
    })
  })
})
