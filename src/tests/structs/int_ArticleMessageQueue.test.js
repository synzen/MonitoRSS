process.env.TEST_ENV = true
const config = require('../../config.js')
const ArticleMessageQueue = require('../../structs/ArticleMessageQueue.js')
const ArticleMessage = require('../../structs/ArticleMessage.js')
const ArticleMessageError = require('../../structs/errors/ArticleMessageError.js')

jest.mock('../../structs/ArticleMessage.js')
jest.mock('../../config.js')

class Bot {
  constructor () {
    this.channels = {
      cache: {
        get: jest.fn((id) => new Channel(id))
      }
    }
  }
}

class Guild {
  constructor () {
    this.roles = {
      cache: {
        get: jest.fn(() => new Role())
      }
    }
  }
}

class Channel {
  constructor (id = '') {
    this.id = id
    this.guild = new Guild()
  }
}

class Role {
  constructor (mentionable = false) {
    this.mentionable = mentionable
    this.setMentionable = jest.fn(mention => {
      return new Promise((resolve, reject) => {
        this.mentionable = mention
        resolve()
      })
    })
  }
}

describe('Int::ArticleMessageQueue', function () {
  beforeAll(function () {
    config.dev = false
  })
  afterEach(function () {
    ArticleMessage.mockRestore()
  })
  describe('articles with no subscriptions', function () {
    it('calls send on article after enqueue', async function () {
      const queue = new ArticleMessageQueue(new Bot())
      await queue.enqueue({})
      expect(ArticleMessage.mock.instances[0].send).toHaveBeenCalledTimes(1)
    })
    it('calls send on all articles after many enqueues', async function () {
      const queue = new ArticleMessageQueue(new Bot())
      const times = 4
      for (let i = 0; i < times; ++i) {
        await queue.enqueue({})
      }
      for (let i = 0; i < times; ++i) {
        expect(ArticleMessage.mock.instances[i].send).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('article with subscriptions', function () {
    it('calls send on all articles', async function () {
      ArticleMessage.mockImplementationOnce(function () {
        this.toggleRoleMentions = true
        this.subscriptionIDs = ['a']
      })
      const queue = new ArticleMessageQueue(new Bot())
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.send()
      expect(ArticleMessage.mock.instances[0].send).toHaveBeenCalledTimes(1)
      expect(ArticleMessage.mock.instances[1].send).toHaveBeenCalledTimes(1)
      expect(ArticleMessage.mock.instances[2].send).toHaveBeenCalledTimes(1)
    })
    it('only calls toggleRoleMentions twice for many articles', async function () {
      const spy = jest.spyOn(ArticleMessageQueue, 'toggleRoleMentionable')
      ArticleMessage.mockImplementation(function () {
        this.toggleRoleMentions = true
        this.subscriptionIDs = ['a']
        this.channelID = 'abc'
      })
      const queue = new ArticleMessageQueue(new Bot())
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.send()
      expect(spy).toHaveBeenCalledTimes(2)
      spy.mockRestore()
    })
    it('clears out the queue after sending', async function () {
      const channelID = 'sfxdrgtrn'
      ArticleMessage.mockImplementation(function () {
        this.toggleRoleMentions = true
        this.subscriptionIDs = ['a']
        this.channelID = channelID
      })
      const queue = new ArticleMessageQueue(new Bot())
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.send()
      expect(queue.queuesWithSubs[channelID]).toBeUndefined()
    })
    it('toggles role mentions for every role', async function () {
      const bot = new Bot()
      const channelOneID = 'abc'
      const channelTwoID = 'def'
      const channelOne = new Channel(channelOneID)
      const channelTwo = new Channel(channelTwoID)
      const guildOne = new Guild()
      const guildTwo = new Guild()
      const roleA = new Role()
      const roleB = new Role()
      channelOne.guild = guildOne
      channelTwo.guild = guildTwo
      bot.channels.cache.get
        .mockReturnValueOnce(channelOne)
        .mockReturnValueOnce(channelOne)
        .mockReturnValueOnce(channelTwo)
        .mockReturnValueOnce(channelTwo)
      guildOne.roles.cache.get.mockReturnValue(roleA)
      guildTwo.roles.cache.get.mockReturnValue(roleB)
      ArticleMessage.mockImplementationOnce(function () {
        this.channelID = channelOneID
        this.toggleRoleMentions = true
        this.subscriptionIDs = [1]
      }).mockImplementationOnce(function () {
        this.channelID = channelTwoID
        this.toggleRoleMentions = true
        this.subscriptionIDs = [2]
      })
      const queue = new ArticleMessageQueue(bot)
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.send()
      expect(roleA.setMentionable).toHaveBeenNthCalledWith(1, true)
      expect(roleA.setMentionable).toHaveBeenNthCalledWith(2, false)
      expect(roleB.setMentionable).toHaveBeenNthCalledWith(1, true)
      expect(roleB.setMentionable).toHaveBeenNthCalledWith(2, false)
    })
    it('does not throw an error if role.setMentionable throws a code-50013 error', async function () {
      const bot = new Bot()
      const queue = new ArticleMessageQueue(bot)
      const channelOneID = 'abc'
      const channelOne = new Channel(channelOneID)
      const guildOne = new Guild()
      const roleA = new Role()
      const error = new Error('perm error')
      error.code = 50013
      channelOne.guild = guildOne
      roleA.setMentionable
        .mockRejectedValue(error)
      bot.channels.cache.get
        .mockReturnValue(channelOne)
      guildOne.roles.cache.get
        .mockReturnValue(roleA)
      ArticleMessage
        .mockImplementationOnce(function () {
          this.channelID = channelOneID
          this.toggleRoleMentions = true
          this.subscriptionIDs = [1]
        })
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.send(bot)
    })
    it('throws the error that articleMessage.send throws, if it is not a non-50013-code error', function (done) {
      const bot = new Bot()
      const channelOneID = 'abc'
      const channelOne = new Channel(channelOneID)
      const guildOne = new Guild()
      const error = new Error('abc')
      channelOne.guild = guildOne
      bot.channels.cache.get
        .mockReturnValue(channelOne)
      ArticleMessage.mockImplementation(function () {
        this.channelID = channelOneID
        this.toggleRoleMentions = true
        this.subscriptionIDs = [1]
        this.send = async () => { throw error }
      })
      const queue = new ArticleMessageQueue(bot)
      queue.enqueue({})
        .then(() => queue.enqueue({}))
        .then(() => queue.send())
        .then(() => done(new Error('Promise resolved')))
        .catch(err => {
          expect(err).toBeInstanceOf(ArticleMessageError)
          expect(err.message).toEqual(error.message)
          done()
        })
        .catch(done)
    })
    it('throws the error and turns off mentionable if delivery fails', async function () {
      const bot = new Bot()
      const queue = new ArticleMessageQueue(bot)
      const channelOneID = 'abc'
      const channelOne = new Channel(channelOneID)
      const guildOne = new Guild()
      const roleA = new Role()
      const error = new Error('format error')
      channelOne.guild = guildOne
      bot.channels.cache.get
        .mockReturnValue(channelOne)
      guildOne.roles.cache.get
        .mockReturnValue(roleA)
      ArticleMessage
        .mockImplementationOnce(function () {
          this.channelID = channelOneID
          this.toggleRoleMentions = true
          this.subscriptionIDs = [1]
          this.send = jest.fn().mockRejectedValue(error)
        })
      await queue.enqueue({})
      await expect(queue.send(bot)).rejects.toThrow(error)
      expect(roleA.setMentionable).toHaveBeenNthCalledWith(1, true)
      expect(roleA.setMentionable).toHaveBeenNthCalledWith(2, false)
    })
  })
})
