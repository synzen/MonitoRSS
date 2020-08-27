const DeliveryPipeline = require('../../structs/DeliveryPipeline.js')
const Feed = require('../../structs/db/Feed.js')
const config = require('../../config.js')
const DeliveryRecord = require('../../models/DeliveryRecord.js')
const ArticleRateLimiter = require('../../structs/ArticleMessageRateLimiter.js')

jest.mock('../../config.js')
jest.mock('../../structs/FeedData.js')
jest.mock('../../structs/db/Feed.js')
jest.mock('../../structs/ArticleMessageRateLimiter.js')
jest.mock('../../structs/ArticleMessage.js')

Feed.isMongoDatabase = true

const Bot = () => ({
  shard: {
    ids: []
  }
})

describe('Unit::structs/DeliveryPipeline', function () {
  const originalModel = DeliveryRecord.Model
  const modelSave = jest.fn()
  beforeEach(() => {
    DeliveryRecord.Model = jest.fn()
      .mockReturnValue({
        save: modelSave
      })
    jest.spyOn(config, 'get')
      .mockReturnValue({
        log: {}
      })
  })
  afterEach(() => {
    DeliveryRecord.Model = originalModel
    jest.restoreAllMocks()
    modelSave.mockReset()
  })
  describe('deliver', function () {
    const channel = {
      send: jest.fn()
    }
    const newArticle = {
      article: {
        _id: 'some id'
      },
      feedObject: {
        channel: 'w4yrh5e',
        url: 'someurl'
      }
    }
    beforeEach(() => {
      jest.spyOn(DeliveryPipeline.prototype, 'getChannel')
        .mockReturnValue(channel)
    })
    afterEach(() => {
      channel.send.mockReset()
    })
    it('records filter blocked', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const articleMessage = {
        foo: 'bar',
        passedFilters: () => false
      }
      jest.spyOn(pipeline, 'createArticleMessage')
        .mockReturnValue(articleMessage)
      await pipeline.deliver(newArticle)
      expect(DeliveryRecord.Model).toHaveBeenCalledWith({
        articleID: newArticle.article._id,
        feedURL: newArticle.feedObject.url,
        channel: newArticle.feedObject.channel,
        delivered: false,
        comment: 'Blocked by filters'
      })
      expect(modelSave).toHaveBeenCalledTimes(1)
    })
    it('records failure', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const articleMessage = {
        foo: 'bar',
        passedFilters: () => true
      }
      jest.spyOn(pipeline, 'createArticleMessage')
        .mockReturnValue(articleMessage)
      const error = new Error('basfdgrf')
      jest.spyOn(ArticleRateLimiter, 'assertWithinLimits')
        .mockRejectedValue(error)
      await pipeline.deliver(newArticle)
      expect(DeliveryRecord.Model).toHaveBeenCalledWith({
        articleID: newArticle.article._id,
        feedURL: newArticle.feedObject.url,
        channel: newArticle.feedObject.channel,
        delivered: false,
        comment: error.message
      })
      expect(modelSave).toHaveBeenCalledTimes(1)
    })
    it('sends the article', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const articleMessage = {
        foo: 'bar',
        passedFilters: () => true
      }
      jest.spyOn(pipeline, 'createArticleMessage')
        .mockReturnValue(articleMessage)
      const sendNewArticle = jest.spyOn(pipeline, 'sendNewArticle')
      await pipeline.deliver(newArticle)
      expect(sendNewArticle).toHaveBeenCalledWith(newArticle, articleMessage)
    })
    it('rejects if failure handling throws', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const articleMessage = {
        foo: 'bar',
        passedFilters: () => true
      }
      jest.spyOn(pipeline, 'createArticleMessage')
        .mockReturnValue(articleMessage)
      const error = new Error('basfdgrf')
      jest.spyOn(ArticleRateLimiter, 'assertWithinLimits')
        .mockRejectedValue(error)
      const handleFailureError = new Error('handle failure error')
      jest.spyOn(pipeline, 'handleArticleFailure')
        .mockRejectedValue(handleFailureError)
      await expect(pipeline.deliver(newArticle))
        .rejects.toThrow(handleFailureError)
    })
  })
})
