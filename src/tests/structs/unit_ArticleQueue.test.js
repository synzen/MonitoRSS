const ArticleQueue = require('../../structs/ArticleQueue.js')
const configuration = require('../../config.js')

jest.mock('../../config.js')

const bot = {
  shard: {
    ids: [1]
  }
}

describe('Unit::structs/ArticleQueue', function () {
  beforeEach(async () => {
    configuration.get.mockReturnValue({
      feeds: {
        articleDequeueRate: 0.01
      }
    })
    jest.spyOn(ArticleQueue.prototype, '_logDebug')
      .mockImplementation()
    jest.useFakeTimers()
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
      jest.spyOn(ArticleQueue.prototype, 'send')
        .mockImplementation()
    })
    it('sends the right article messages', async () => {
      const articleData1 = {
        id: 1 // for debugging
      }
      const articleData2 = {
        id: 2
      }
      const articleData3 = {
        id: 3
      }
      const articleDataQueue = [
        articleData1,
        articleData2,
        articleData3
      ]
      const queue = new ArticleQueue({ ...bot })
      queue.queue = articleDataQueue
      queue.send = jest.fn()
      await queue.dequeue(queue.queue, 2)
      expect(queue.send)
        .toHaveBeenCalledTimes(2)
      expect(queue.send)
        .toHaveBeenCalledWith(articleData1)
      expect(queue.send)
        .toHaveBeenCalledWith(articleData2)
      expect(queue.send)
        .not.toHaveBeenCalledWith(articleData3)
    })
  })
  describe('constructor', () => {
    it('creates the interval correctly for rate of <1', () => {
      configuration.get.mockReturnValue({
        feeds: {
          articleDequeueRate: 0.2
        }
      })
      // eslint-disable-next-line no-new
      const queue = new ArticleQueue({ ...bot })
      queue.dequeue = jest.fn()
      queue.queue = [1, 3, 4]
      queue.serviceBacklogQueue = []
      const expectedDequeueRate = 1
      const expectedInterval = 5000
      expect(setInterval)
        .toHaveBeenCalledWith(expect.any(Function), expectedInterval)
      expect(setInterval).toHaveBeenCalledTimes(1)
      jest.advanceTimersByTime(expectedInterval)
      expect(queue.dequeue).toHaveBeenCalledWith(queue.queue, expectedDequeueRate)
    })
    it('creates interval correctly for rate of >1', () => {
      configuration.get.mockReturnValue({
        feeds: {
          articleDequeueRate: 5
        }
      })
      const queue = new ArticleQueue({ ...bot })
      queue.queue = [4, 5, 6]
      queue.dequeue = jest.fn()
      const expectedDequeueRate = 5
      const expectedInterval = 1000
      expect(setInterval)
        .toHaveBeenCalledWith(expect.any(Function), expectedInterval)
      expect(setInterval).toHaveBeenCalledTimes(1)
      jest.advanceTimersByTime(expectedInterval)
      expect(queue.dequeue).toHaveBeenCalledWith(queue.queue, expectedDequeueRate)
    })
  })
})
