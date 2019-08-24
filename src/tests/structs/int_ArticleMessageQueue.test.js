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
  describe('articles with no subscriptions', function () {
    afterEach(function () {
      ArticleMessage.mockRestore()
    })
    it('calls send on all articles after enqueue', async function () {
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
})
