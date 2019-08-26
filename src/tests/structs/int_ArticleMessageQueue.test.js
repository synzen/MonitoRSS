const ArticleMessageQueue = require('../../structs/ArticleMessageQueue.js')
const ArticleMessage = require('../../structs/ArticleMessage.js')

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

describe('Int::ArticleMessageQueue', function () {
  afterEach(function () {
    ArticleMessage.mockRestore()
  })
  describe('articles with no subscriptions', function () {
    it('calls send on article after enqueue', async function () {
      const queue = new ArticleMessageQueue()
      await queue.enqueue({})
      expect(ArticleMessage.mock.instances[0].send).toHaveBeenCalledTimes(1)
    })
    it('calls _sendNext the right number of times', async function () {
      const queue = new ArticleMessageQueue()
      const channelID = 'asb'
      ArticleMessage.mockImplementation(function () {
        this.channelId = channelID
        return this
      })
      const spy = jest.spyOn(queue, '_sendNext')
      queue.queues[channelID] = [new ArticleMessage(), new ArticleMessage(), new ArticleMessage()]
      await queue.enqueue({})
      expect(spy).toHaveBeenCalledTimes(5)
      spy.mockRestore()
    })
  })

  describe('article with subscriptions', function () {
    it('calls send on all articles', async function () {
      const queue = new ArticleMessageQueue()
      ArticleMessage.mockImplementation(function () {
        this.toggleRoleMentions = true
        this.subscriptionIds = ['a']
      })
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.send(new Bot())
      expect(ArticleMessage.mock.instances[0].send).toHaveBeenCalledTimes(1)
      expect(ArticleMessage.mock.instances[1].send).toHaveBeenCalledTimes(1)
      expect(ArticleMessage.mock.instances[2].send).toHaveBeenCalledTimes(1)
    })

    it('only calls toggleRoleMentions twice for many articles', async function () {
      const queue = new ArticleMessageQueue()
      const spy = jest.spyOn(ArticleMessageQueue, 'toggleRoleMentionable')
      ArticleMessage.mockImplementation(function () {
        this.toggleRoleMentions = true
        this.subscriptionIds = ['a']
        this.channelId = 'abc'
      })
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.enqueue({})
      await queue.send(new Bot())
      expect(spy).toHaveBeenCalledTimes(2)
      spy.mockRestore()
    })
  })
})
