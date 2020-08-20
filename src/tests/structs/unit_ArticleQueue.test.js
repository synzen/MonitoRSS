const ArticleQueue = require('../../structs/ArticleQueue.js')
const configuration = require('../../config.js')

jest.mock('../../config.js')

const bot = {
  shard: {
    ids: [1]
  }
}

jest.useFakeTimers()

describe('Unit::structs/ArticleQueue', function () {
  beforeEach(async () => {
    configuration.get.mockReturnValue({
      feeds: {
        articleDequeueRate: 0.01
      }
    })
  })
  afterEach(() => {
    jest.resetAllMocks()
  })
  describe('enqueue', () => {
    it('adds the data to the queue', () => {
      const newArticle = {
        foo: 'baz'
      }
      const articleMessage = {
        foh: 'ban'
      }
      const queue = new ArticleQueue({ ...bot })
      queue.enqueue(newArticle, articleMessage)
      expect(queue.queue).toEqual([{
        newArticle,
        articleMessage
      }])
    })
  })
  describe('dequeue', () => {
    beforeEach(() => {
      jest.spyOn(ArticleQueue.prototype, 'recordSuccess')
        .mockImplementation()
      jest.spyOn(ArticleQueue.prototype, 'recordFailure')
        .mockImplementation()
    })
    it('sends the right article messages', async () => {
      const message1Send = jest.fn()
      const message2Send = jest.fn()
      const message3Send = jest.fn()
      const articleDataQueue = [{
        articleMessage: {
          id: 1, // for debugging
          send: message1Send
        }
      }, {
        articleMessage: {
          id: 2,
          send: message2Send
        }
      }, {
        articleMessage: {
          id: 3,
          send: message3Send
        }
      }]
      const queue = new ArticleQueue({ ...bot })
      queue.queue = articleDataQueue
      await queue.dequeue(2)
      expect(message1Send)
        .toHaveBeenCalledTimes(1)
      expect(message2Send)
        .toHaveBeenCalledTimes(1)
      expect(message3Send)
        .toHaveBeenCalledTimes(0)
    })
  })
  describe('constructor', () => {
    it.only('creates the interval correctly for rate of <1', () => {
      configuration.get.mockReturnValue({
        feeds: {
          articleDequeueRate: 0.2
        }
      })
      // eslint-disable-next-line no-new
      const queue = new ArticleQueue({ ...bot })
      queue.dequeue = jest.fn()
      const expectedDequeueRate = 1
      const expectedInterval = 5000
      expect(setInterval)
        .toHaveBeenCalledWith(expect.any(Function), expectedInterval)
      expect(setInterval).toHaveBeenCalledTimes(1)
      jest.advanceTimersByTime(expectedInterval)
      expect(queue.dequeue).toHaveBeenCalledWith(expectedDequeueRate)
    })
    it('creates interval correctly for rate of >1', () => {
      configuration.get.mockReturnValue({
        feeds: {
          articleDequeueRate: 5
        }
      })
      const queue = new ArticleQueue({ ...bot })
      queue.dequeue = jest.fn()
      const expectedDequeueRate = 5
      const expectedInterval = 1000
      expect(setInterval)
        .toHaveBeenCalledWith(expect.any(Function), expectedInterval)
      expect(setInterval).toHaveBeenCalledTimes(1)
      jest.advanceTimersByTime(expectedInterval)
      expect(queue.dequeue).toHaveBeenCalledWith(expectedDequeueRate)
    })
  })
})
