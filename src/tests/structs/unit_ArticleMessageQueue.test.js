const ArticleMessageQueue = require('../../structs/ArticleMessageQueue.js')
const ArticleMessage = require('../../structs/ArticleMessage.js')
const config = require('../../config.js')

jest.mock('../../structs/ArticleMessage.js')
jest.mock('../../config.js')

class Bot {
  constructor () {
    this.channels = {
      get: jest.fn((id) => new Channel(id))
    }
  }
}

class Guild {
  constructor () {
    this.roles = {
      get: jest.fn()
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
  describe('toggleRoleMentionability', function () {
    describe('does not changed mentionable', function () {
      it('when there are no role IDs, returns undefined', async function () {
        await expect(ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(), {})).resolves.toEqual(undefined)
      })

      it('when the channel cannot be fetched, returns undefined', async function () {
        const bot = new Bot()
        bot.channels.get.mockResolvedValueOnce(undefined)
        await expect(ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(), bot)).resolves.toEqual(undefined)
      })

      it('if roles cannot be fetched, and returns empty array', async function () {
        const bot = new Bot()
        await expect(ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(['123']), bot)).resolves.toEqual([])
      })

      it('if roles are already set to the passed in mentionable parameter, returns empty array', async function () {
        const bot = new Bot()
        const channel = new Channel()
        const guild = new Guild()
        const role1 = new Role(true)
        const role2 = new Role(true)
        guild.roles.get
          .mockReturnValueOnce(role1)
          .mockReturnValueOnce(role2)
        channel.guild = guild
        bot.channels.get.mockReturnValueOnce(channel)
        await expect(ArticleMessageQueue.toggleRoleMentionable(true, '123', new Set(['a', 'b']), bot)).resolves.toEqual([])
        expect(guild.roles.get).toHaveBeenCalledTimes(2)
      })
    })

    it('calls setMentionable for roles', async function () {
      const bot = new Bot()
      const channel = new Channel()
      const guild = new Guild()
      const role1 = new Role(true)
      const role2 = new Role(true)
      channel.guild = guild
      guild.roles.get
        .mockReturnValueOnce(role1)
        .mockReturnValueOnce(role2)
      bot.channels.get.mockReturnValueOnce(channel)
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
      guild.roles.get
        .mockReturnValueOnce(role1)
        .mockReturnValueOnce(role2)
      bot.channels.get.mockReturnValueOnce(channel)
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
      guild.roles.get
        .mockReturnValueOnce(role1)
        .mockReturnValueOnce(role2)
      bot.channels.get.mockReturnValueOnce(channel)
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
    it('does not call pushNext when config.dev is true', function () {
      const originalValue = config.dev
      config.dev = true
      const queue = new ArticleMessageQueue()
      queue._pushNext = jest.fn()
      queue.enqueue({})
      config.dev = originalValue
      expect(queue._pushNext).not.toHaveBeenCalled()
    })

    it('calls ArticleMessage constructor', function () {
      const queue = new ArticleMessageQueue()
      queue.enqueue({})
      expect(ArticleMessage).toHaveBeenCalledTimes(1)
    })

    it('calls pushNext', function () {
      const queue = new ArticleMessageQueue()
      queue._pushNext = jest.fn()
      queue.enqueue({})
      expect(queue._pushNext).toHaveBeenCalledTimes(1)
    })
  })

  describe('_pushNext', function () {
    it('adds to regular queue for article with no subscriptions', function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const channelID = '1asdw46'
      articleMessage.channelId = channelID
      queue._sendNext = jest.fn()
      queue._pushNext(articleMessage)
      expect(Array.isArray(queue.queues[channelID])).toEqual(true)
      expect(queue.queues[channelID]).toHaveLength(1)
      expect(queue.queues[channelID][0]).toEqual(articleMessage)
    })
    it('adds to queue with subs for article with subscriptions and toggleRoleMentions is true', function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      articleMessage.subscriptionIds = ['a', 'b']
      articleMessage.toggleRoleMentions = true
      const channelID = '1asdw46'
      articleMessage.channelId = channelID
      queue._sendNext = jest.fn()
      queue._pushNext(articleMessage)
      expect(Array.isArray(queue.queuesWithSubs[channelID])).toEqual(true)
      expect(queue.queuesWithSubs[channelID]).toHaveLength(1)
      expect(queue.queuesWithSubs[channelID][0]).toEqual(articleMessage)
    })
    it('calls sendNext once', function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      queue._sendNext = jest.fn()
      queue._pushNext(articleMessage)
      expect(queue._sendNext).toHaveBeenCalledTimes(1)
    })
  })

  describe('_sendNext', function () {
    it('shifts the element from the queue', function () {
      const channelID = '123'
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const articleMessageTwo = new ArticleMessage()
      queue.queues[channelID] = [articleMessage, articleMessageTwo]
      queue._sendNext(channelID)
      expect(queue.queues[channelID]).toEqual([articleMessageTwo])
    })
    it('calls send on the article message', function () {
      const channelID = '123'
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      queue.queues[channelID] = [articleMessage]
      queue._sendNext(channelID)
      expect(articleMessage.send).toHaveBeenCalledTimes(1)
    })
    it('calls sendNext the correct number of times', async function () {
      const channelID = '123'
      const queue = new ArticleMessageQueue()
      queue.queues[channelID] = [new ArticleMessage(), new ArticleMessage(), new ArticleMessage(), new ArticleMessage()]
      const spy = jest.spyOn(queue, '_sendNext')
      await queue._sendNext(channelID)
      expect(spy).toHaveBeenCalledTimes(5)
      spy.mockRestore()
    })
  })

  describe('send', function () {
    it('calls toggleRoleMentionable the correct number of times', function () {
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
      queue.send()
      expect(ArticleMessageQueue.toggleRoleMentionable).toHaveBeenCalledTimes(2)
      ArticleMessageQueue.toggleRoleMentionable = origFunc
    })
    it('calls toggleRoleMentionable with the right arguments', function () {
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
      queue._sendDelayedQueue = jest.fn()
      queue.send(bot)
      expect(ArticleMessageQueue.toggleRoleMentionable).toHaveBeenCalledWith(true, channelOne, new Set(['1', '2', '3', '4', '5']), bot)
      expect(ArticleMessageQueue.toggleRoleMentionable).toHaveBeenNthCalledWith(2, true, channelTwo, new Set(['6', '7']), bot)
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
      await queue._sendDelayedQueue({}, channelID, [ articleMessage, articleMessageTwo ])
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenCalledWith({}, channelID, [ articleMessage, articleMessageTwo ])
      expect(spy).toHaveBeenNthCalledWith(2, {}, channelID, [ articleMessageTwo ], undefined, undefined)
      spy.mockRestore()
    })
    it('turns off role mentionability at the end', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      const articleMessageTwo = new ArticleMessage()
      const channelID = 'abc'
      const roleIDs = [1, 2, 3]
      await queue._sendDelayedQueue({}, channelID, [ articleMessage, articleMessageTwo ], roleIDs)
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
      queue._sendDelayedQueue({}, '', [articleMessage])
      expect(articleMessage.send).toHaveBeenCalledTimes(1)
    })
    it('adds to the article message\'s text if there is an error', async function () {
      const queue = new ArticleMessageQueue()
      const articleMessage = new ArticleMessage()
      queue._sendDelayedQueue({}, '', [articleMessage], [], new Error())
      expect(articleMessage.text).toEqual(expect.stringContaining('Failed to toggle'))
    })
    // it('', async function () {
    //   const queue = new ArticleMessageQueue()
    //   const articleMessage = new ArticleMessage()
    //   const articleMessageTwo = new ArticleMessage()
    //   const origFunc = ArticleMessageQueue.toggleRoleMentionable
    //   ArticleMessageQueue.toggleRoleMentionable = jest.fn()
    //   const spy = jest.spyOn(queue, '_sendDelayedQueue')
    //   await queue._sendDelayedQueue({}, 'abc', [ articleMessage, articleMessageTwo ])
    //   expect(spy).toHaveBeenCalledTimes(2)
    //   spy.mockRestore()
    //   ArticleMessageQueue.toggleRoleMentionable = origFunc
    // })
  })
})
