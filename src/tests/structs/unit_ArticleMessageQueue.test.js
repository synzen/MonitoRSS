process.env.TEST_ENV = true
const ArticleMessageQueue = require('../../structs/ArticleMessageQueue.js')
const ArticleMessage = require('../../structs/ArticleMessage.js')
const ArticleMessageError = require('../../structs/errors/ArticleMessageError.js')
const config = require('../../config.js')

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
        get: jest.fn()
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
    this.setMentionable = jest.fn(() => Promise.resolve())
  }
}

describe('Unit::ArticleMessageQueue', function () {
  beforeAll(function () {
    config.dev = false
  })
  describe('toggleRoleMentionability', function () {
    describe('does not changed mentionable', function () {
      it('when there are no role IDs, returns undefined', function () {
        return expect(ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(), {})).resolves.toEqual(undefined)
      })

      it('when the channel cannot be fetched, returns undefined', function () {
        const bot = new Bot()
        bot.channels.cache.get.mockResolvedValueOnce(undefined)
        return expect(ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(), bot)).resolves.toEqual(undefined)
      })

      it('if roles cannot be fetched, and returns 0', function () {
        const bot = new Bot()
        return expect(ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(['123']), bot)).resolves.toEqual(0)
      })

      it('if roles are already set to the passed in mentionable parameter, returns 0', async function () {
        const bot = new Bot()
        const channel = new Channel()
        const guild = new Guild()
        const role1 = new Role(true)
        const role2 = new Role(true)
        guild.roles.cache.get
          .mockReturnValueOnce(role1)
          .mockReturnValueOnce(role2)
        channel.guild = guild
        bot.channels.cache.get.mockReturnValueOnce(channel)
        expect(await ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(['a', 'b']), bot)).toEqual(0)
        expect(guild.roles.cache.get).toHaveBeenCalledTimes(2)
      })
    })

    it('returns the number of roles toggled', async function () {
      const bot = new Bot()
      const channel = new Channel()
      const guild = new Guild()
      const role1 = new Role(true)
      const role2 = new Role(false)
      guild.roles.cache.get
        .mockReturnValueOnce(role1)
        .mockReturnValueOnce(role2)
      channel.guild = guild
      bot.channels.cache.get.mockReturnValueOnce(channel)
      expect(await ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(['a', 'b']), bot)).toEqual(1)
      expect(guild.roles.cache.get).toHaveBeenCalledTimes(2)
    })

    it('calls setMentionable for roles', async function () {
      const bot = new Bot()
      const channel = new Channel()
      const guild = new Guild()
      const role1 = new Role(true)
      const role2 = new Role(true)
      channel.guild = guild
      guild.roles.cache.get
        .mockReturnValueOnce(role1)
        .mockReturnValueOnce(role2)
      bot.channels.cache.get.mockReturnValueOnce(channel)
      await ArticleMessageQueue.toggleRoleMentionable(false, '123', new Set(['a', 'b']), bot)
      expect(role1.setMentionable).toHaveBeenCalledTimes(1)
      expect(role2.setMentionable).toHaveBeenCalledTimes(1)
    })

    it('rejects with the error given if the code is not 50013', async function () {
      const bot = new Bot()
      const channel = new Channel()
      const guild = new Guild()
      const role1 = new Role(true)
      const role2 = new Role(true)
      const error = new Error('asdas')
      role1.setMentionable.mockRejectedValueOnce(error)
      channel.guild = guild
      guild.roles.cache.get
        .mockReturnValueOnce(role1)
        .mockReturnValueOnce(role2)
      bot.channels.cache.get.mockReturnValueOnce(channel)
      try {
        await ArticleMessageQueue.toggleRoleMentionable(false, '123', new Set(['a', 'b']), bot)
      } catch (err) {
        expect(err.message).toEqual(error.message)
      }
    })

    it('rejects with custom error if the code is 50013', async function () {
      const bot = new Bot()
      const channel = new Channel()
      const guild = new Guild()
      const role1 = new Role(true)
      const role2 = new Role(true)
      const error = new Error('asdas')
      error.code = 50013
      role1.setMentionable.mockRejectedValueOnce(error)
      channel.guild = guild
      guild.roles.cache.get
        .mockReturnValueOnce(role1)
        .mockReturnValueOnce(role2)
      bot.channels.cache.get.mockReturnValueOnce(channel)
      try {
        await ArticleMessageQueue.toggleRoleMentionable(false, '123', new Set(['a', 'b']), bot)
      } catch (err) {
        expect(err.message).toEqual(expect.stringContaining('toggle role permissions'))
      }
    })
  })

  describe('enqueue', function () {
    afterEach(function () {
      ArticleMessage.mockClear()
    })
    it('does not call pushNext when config.dev is true', async function () {
      const originalValue = config.dev
      config.dev = true
      const queue = new ArticleMessageQueue()
      queue._pushNext = jest.fn()
      await queue.enqueue({})
      config.dev = originalValue
      expect(queue._pushNext).not.toHaveBeenCalled()
    })

    it('creates the right number of ArticleMessages', async function () {
      const queue = new ArticleMessageQueue()
      const times = 13
      const promises = []
      const origFunc = queue._pushNext
      queue._pushNext = jest.fn()
      for (let i = 0; i < times; ++i) {
        promises.push(queue.enqueue({}))
      }
      await Promise.all(promises)
      expect(ArticleMessage.mock.instances.length).toEqual(times)
      queue._pushNext = origFunc
    })

    it('calls ArticleMessage constructor', async function () {
      const queue = new ArticleMessageQueue()
      await queue.enqueue({})
      expect(ArticleMessage).toHaveBeenCalledTimes(1)
    })

    it('calls pushNext', async function () {
      const queue = new ArticleMessageQueue()
      queue._pushNext = jest.fn()
      await queue.enqueue({})
      expect(queue._pushNext).toHaveBeenCalledTimes(1)
    })
  })

  describe('_pushNext', function () {
    it('immediately sends an article with no subscriptions', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const channelID = '1asdw46'
      articleMessage.channelId = channelID
      await queue._pushNext(articleMessage)
      expect(articleMessage.send).toHaveBeenCalledTimes(1)
    })
    it('adds to queue with subs for article with subscriptions and toggleRoleMentions is true', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      articleMessage.subscriptionIds = ['a', 'b']
      articleMessage.toggleRoleMentions = true
      const channelID = '1asdw46'
      articleMessage.channelId = channelID
      await queue._pushNext(articleMessage)
      expect(Array.isArray(queue.queuesWithSubs[channelID])).toEqual(true)
      expect(queue.queuesWithSubs[channelID]).toHaveLength(1)
      expect(queue.queuesWithSubs[channelID][0]).toEqual(articleMessage)
    })
  })

  describe('send', function () {
    it('calls toggleRoleMentionable the correct number of times', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      articleMessage.subscriptionIds = ['1', '2']
      const articleMessageTwo = new ArticleMessage()
      articleMessageTwo.subscriptionIds = ['3', '4', '5']
      const articleMessageThree = new ArticleMessage()
      articleMessageThree.subscriptionIds = ['6', '7', '7']
      queue.queuesWithSubs['abc'] = [articleMessage, articleMessageTwo]
      queue.queuesWithSubs['d'] = [articleMessageThree]
      const origFunc = ArticleMessageQueue.toggleRoleMentionable
      ArticleMessageQueue.toggleRoleMentionable = jest.fn(() => Promise.resolve())
      queue._sendDelayedQueue = jest.fn()
      await queue.send()
      expect(ArticleMessageQueue.toggleRoleMentionable).toHaveBeenCalledTimes(2)
      ArticleMessageQueue.toggleRoleMentionable = origFunc
    })
    it('calls toggleRoleMentionable with the right arguments', async function () {
      const channelOne = 'abc'
      const channelTwo = 'dcas'
      const bot = new Bot()
      const articleMessage = new ArticleMessage()
      articleMessage.subscriptionIds = ['1', '2']
      const articleMessageTwo = new ArticleMessage()
      articleMessageTwo.subscriptionIds = ['3', '4', '5']
      const articleMessageThree = new ArticleMessage()
      articleMessageThree.subscriptionIds = ['6', '7', '7']
      const queue = new ArticleMessageQueue(bot)
      queue.queuesWithSubs[channelOne] = [articleMessage, articleMessageTwo]
      queue.queuesWithSubs[channelTwo] = [articleMessageThree]
      const origFunc = ArticleMessageQueue.toggleRoleMentionable
      ArticleMessageQueue.toggleRoleMentionable = jest.fn(() => Promise.resolve())
      queue._sendDelayedQueue = jest.fn()
      await queue.send()
      expect(ArticleMessageQueue.toggleRoleMentionable).toHaveBeenCalledWith(true, channelOne, new Set(['1', '2', '3', '4', '5']), bot)
      expect(ArticleMessageQueue.toggleRoleMentionable).toHaveBeenNthCalledWith(2, true, channelTwo, new Set(['6', '7']), bot)
      ArticleMessageQueue.toggleRoleMentionable = origFunc
    })
    it('throws the error that _sendDelayedQueue throws after toggling mentions', async function (done) {
      const channelOne = 'abc'
      const channelTwo = 'dcas'
      const bot = new Bot()
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      articleMessage.subscriptionIds = ['1', '2']
      const articleMessageTwo = new ArticleMessage()
      articleMessageTwo.subscriptionIds = ['3', '4', '5']
      const articleMessageThree = new ArticleMessage()
      articleMessageThree.subscriptionIds = ['6', '7', '7']
      queue.queuesWithSubs[channelOne] = [articleMessage, articleMessageTwo]
      queue.queuesWithSubs[channelTwo] = [articleMessageThree]
      const origFunc = ArticleMessageQueue.toggleRoleMentionable
      ArticleMessageQueue.toggleRoleMentionable = jest.fn(() => Promise.resolve())
      const error = new ArticleMessageError('hubba hubba')
      queue._sendDelayedQueue = jest.fn(() => Promise.reject(error))
      try {
        await queue.send(bot)
        done(new Error('Promise resolved when it should not'))
      } catch (err) {
        expect(err).toEqual(error)
        done()
      }
      ArticleMessageQueue.toggleRoleMentionable = origFunc
    })
  })

  describe('_sendDelayedQueue', function () {
    const origFunc = ArticleMessageQueue.toggleRoleMentionable
    beforeEach(function () {
      ArticleMessageQueue.toggleRoleMentionable = jest.fn()
    })
    afterEach(function () {
      ArticleMessageQueue.toggleRoleMentionable = origFunc
    })
    it('is recursively called the correct number of times', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const articleMessageTwo = new ArticleMessage()
      const spy = jest.spyOn(queue, '_sendDelayedQueue')
      const channelID = 'abc'
      await queue._sendDelayedQueue({}, channelID, [ articleMessage, articleMessageTwo ], [], undefined, 1)
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenNthCalledWith(1, {}, channelID, [ articleMessage, articleMessageTwo ], [], undefined, 1)
      expect(spy).toHaveBeenNthCalledWith(2, {}, channelID, [ articleMessageTwo ], [], undefined, 1)
      spy.mockRestore()
    })
    it('turns off role mentionability at the end', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const articleMessageTwo = new ArticleMessage()
      const channelID = 'abc'
      const roleIDs = [1, 2, 3]
      await queue._sendDelayedQueue({}, channelID, [ articleMessage, articleMessageTwo ], roleIDs, null, 1)
      expect(ArticleMessageQueue.toggleRoleMentionable).toHaveBeenCalledTimes(1)
      expect(ArticleMessageQueue.toggleRoleMentionable).toHaveBeenCalledWith(false, channelID, roleIDs, {})
    })
    it('does not turn off role mentionability at the end if there is an error', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const articleMessageTwo = new ArticleMessage()
      const channelID = 'abc'
      const roleIDs = [1, 2, 3]
      const error = new Error('abc')
      await queue._sendDelayedQueue({}, channelID, [ articleMessage, articleMessageTwo ], roleIDs, error)
      expect(ArticleMessageQueue.toggleRoleMentionable).not.toHaveBeenCalled()
    })
    it('sends the article message in the queue', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      await queue._sendDelayedQueue({}, '', [articleMessage])
      expect(articleMessage.send).toHaveBeenCalledTimes(1)
    })
    it('adds to the article message\'s text if there is an error', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      await queue._sendDelayedQueue({}, '', [articleMessage], [], new Error())
      expect(articleMessage.text).toEqual(expect.stringContaining('Failed to toggle'))
    })
    it('deletes the channel queue after all is finished sending', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const channelID = 'azsfdegr'
      queue.queuesWithSubs[channelID] = [articleMessage]
      await queue._sendDelayedQueue({}, channelID, queue.queuesWithSubs[channelID], [])
      expect(queue.queuesWithSubs[channelID]).toBeUndefined()
    })
    it('deletes the channel queue of there is an error', function (done) {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const channelID = 'azsfdegr'
      articleMessage.send.mockRejectedValueOnce(new Error())
      queue.queuesWithSubs[channelID] = [articleMessage]
      queue._sendDelayedQueue({}, channelID, queue.queuesWithSubs[channelID], [])
        .then(() => done(new Error('Promise resolved with error')))
        .catch(() => expect(queue.queuesWithSubs[channelID]).toBeUndefined())
        .then(done)
        .catch(done)
    })
    it('throws an ArticleMessageError if there is an error', function (done) {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const channelID = 'azsfdegr'
      articleMessage.send.mockRejectedValueOnce(new Error())
      queue.queuesWithSubs[channelID] = [articleMessage]
      queue._sendDelayedQueue({}, channelID, queue.queuesWithSubs[channelID], [])
        .then(() => done(new Error('Promise resolved with error')))
        .catch(err => expect(err instanceof ArticleMessageError).toEqual(true))
        .then(done)
        .catch(done)
    })
  })
})
