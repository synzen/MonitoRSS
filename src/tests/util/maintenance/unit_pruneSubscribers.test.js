process.env.TEST_ENV = true
const Feed = require('../../../structs/db/Feed.js')
const Subscriber = require('../../../structs/db/Subscriber.js')
const pruneSubscribers = require('../../../util/maintenance/pruneSubscribers.js')

jest.mock('../../../structs/db/Feed.js')
jest.mock('../../../structs/db/Subscriber.js')

Subscriber.TYPES = {
  USER: 'user',
  ROLE: 'role'
}

class Guild {
  constructor () {
    this.roles = new Set()
  }
}
class Bot {
  constructor () {
    this.users = new Map()
  }
}

class ShardedBot extends Bot {
  constructor () {
    super()
    this.shard = {
      count: 6
    }
  }
}

describe('utils/maintenance/pruneSubscribers', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  afterEach(function () {
    Feed.getAll.mockReset()
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
      guilds: new Map([['guildA', {}]]),
      users: {
        has: () => true
      }
    }
    Subscriber.getAll.mockResolvedValue(subscribers)
    Feed.getAll.mockResolvedValue(feeds)
    await pruneSubscribers(bot)
    expect(subscribers[0].delete).toHaveBeenCalled()
    expect(subscribers[1].delete).toHaveBeenCalled()
    expect(subscribers[2].delete).not.toHaveBeenCalled()
  })
  describe('feed exists', function () {
    describe('sharded bot', function () {
      it(`doesn't prune subscribers whose guilds are not within the bot`, async function () {
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
            count: 6
          },
          guilds: new Map([['guildB']])
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        Feed.getAll.mockResolvedValue(feeds)
        await pruneSubscribers(bot)
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
        const users = new Set()
        users.add(subscribers[1].id)
        const bot = {
          shard: {
            count: 6
          },
          guilds: new Map([['guildA', {}]]),
          users
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        Feed.getAll.mockResolvedValue(feeds)
        await pruneSubscribers(bot)
        expect(subscribers[1].delete).not.toHaveBeenCalled()
        expect(subscribers[0].delete).toHaveBeenCalled()
      })
      it('prunes roles if they is not in guild that exists in bot', async function () {
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
        const guildA = new Guild()
        guildA.roles.add(subscribers[1].id)
        const bot = {
          shard: {
            count: 6
          },
          guilds: new Map([['guildA', guildA]])
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        Feed.getAll.mockResolvedValue(feeds)
        await pruneSubscribers(bot)
        expect(subscribers[1].delete).not.toHaveBeenCalled()
        expect(subscribers[0].delete).toHaveBeenCalled()
      })
      it('prunes roles and useres if they both do not exist', async function () {
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
        const guildA = new Guild()
        const users = new Set()
        const bot = {
          shard: {
            count: 6
          },
          guilds: new Map([['guildA', guildA]]),
          users
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        Feed.getAll.mockResolvedValue(feeds)
        await pruneSubscribers(bot)
        expect(subscribers[1].delete).toHaveBeenCalled()
        expect(subscribers[0].delete).toHaveBeenCalled()
      })
    })
    describe('unsharded', function () {
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
        const users = new Set()
        users.add(subscribers[1].id)
        const bot = {
          guilds: new Map([['guildA', {}]]),
          users
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        Feed.getAll.mockResolvedValue(feeds)
        await pruneSubscribers(bot)
        expect(subscribers[1].delete).not.toHaveBeenCalled()
        expect(subscribers[0].delete).toHaveBeenCalled()
      })
      it('prunes roles if they is not in guild that exists in bot', async function () {
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
        const guildA = new Guild()
        guildA.roles.add(subscribers[1].id)
        const bot = {
          guilds: new Map([['guildA', guildA]])
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        Feed.getAll.mockResolvedValue(feeds)
        await pruneSubscribers(bot)
        expect(subscribers[1].delete).not.toHaveBeenCalled()
        expect(subscribers[0].delete).toHaveBeenCalled()
      })
      it('prunes roles and useres if they both do not exist', async function () {
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
        const guildA = new Guild()
        const users = new Set()
        const bot = {
          guilds: new Map([['guildA', guildA]]),
          users
        }
        Subscriber.getAll.mockResolvedValue(subscribers)
        Feed.getAll.mockResolvedValue(feeds)
        await pruneSubscribers(bot)
        expect(subscribers[1].delete).toHaveBeenCalled()
        expect(subscribers[0].delete).toHaveBeenCalled()
      })
    })
  })
})
