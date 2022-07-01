const DeliveryPipeline = require('../../structs/DeliveryPipeline.js')
const config = require('../../config.js')
const DeliveryRecord = require('../../models/DeliveryRecord.js')
const ArticleMessage = require('../../structs/ArticleMessage.js')
const Feed = require('../../structs/db/Feed.js')

jest.mock('../../config.js')
jest.mock('../../structs/FeedData.js')
jest.mock('../../structs/db/Feed.js')
jest.mock('../../structs/ArticleMessageRateLimiter.js')
jest.mock('../../structs/ArticleMessage.js')
// jest.mock('../../models/DeliveryRecord.js')

const Bot = () => ({
  shard: {
    ids: []
  }
})

const NewArticle = () => ({
  feedObject: {},
  article: {}
})

Feed.isMongoDatabase = true

describe('Unit::structs/DeliveryPipeline', function () {
  beforeAll(() => {
    DeliveryRecord.Model = jest.fn()
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    it('sets the fields', function () {
      const bot = {
        foo: 'bar',
        shard: {
          ids: []
        }
      }
      jest.spyOn(config, 'get')
        .mockReturnValue({
          log: {
            unfiltered: true
          },
          apis: {
            pledge: {},
            discordHttpGateway: {}
          }
        })
      const pipeline = new DeliveryPipeline(bot)
      expect(pipeline.bot).toEqual(bot)
      expect(pipeline.logFiltered).toEqual(true)
    })
  })
  describe('getChannel', () => {
    it('returns the channel', () => {
      const newArticle = {
        feedObject: {}
      }
      const pipeline = new DeliveryPipeline(Bot())
      const get = jest.fn()
      pipeline.bot = {
        channels: {
          cache: {
            get
          }
        }
      }
      const channel = {
        bla: 'dah'
      }
      get.mockReturnValue(channel)
      expect(pipeline.getChannel(newArticle))
        .toEqual(channel)
    })
  })
  describe('createArticleMessage', () => {
    it('returns the created article message', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const createdMessage = {
        foo: 'baz'
      }
      jest.spyOn(ArticleMessage, 'create')
        .mockReturnValue(createdMessage)
      await expect(pipeline.createArticleMessage({}))
        .resolves.toEqual(createdMessage)
    })
  })
  describe('deliver', () => {
    beforeEach(() => {
      jest.spyOn(DeliveryPipeline.prototype, 'getChannel')
        .mockReturnValue({})
      jest.spyOn(DeliveryPipeline.prototype, 'createArticleMessage')
        .mockResolvedValue()
      jest.spyOn(DeliveryPipeline.prototype, 'handleArticleBlocked')
        .mockResolvedValue()
      jest.spyOn(DeliveryPipeline.prototype, 'sendNewArticle')
        .mockResolvedValue()
      jest.spyOn(DeliveryPipeline.prototype, 'handleArticleFailure')
        .mockResolvedValue()
    })
    it('does not send if channel is not found', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const sendNewArticle = jest.spyOn(pipeline, 'sendNewArticle')
      jest.spyOn(pipeline, 'getChannel')
        .mockReturnValue(undefined)
      await pipeline.deliver(NewArticle())
      expect(sendNewArticle).not.toHaveBeenCalled()
    })
    it('does not send article if it does not pass filters', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const sendNewArticle = jest.spyOn(pipeline, 'sendNewArticle')
      jest.spyOn(pipeline, 'createArticleMessage')
        .mockResolvedValue({
          passedFilters: () => false
        })
      await pipeline.deliver(NewArticle())
      expect(sendNewArticle).not.toHaveBeenCalled()
    })
    it('sends the article for delivery', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const articleMessage = {
        passedFilters: () => true
      }
      const sendNewArticle = jest.spyOn(pipeline, 'sendNewArticle')
      jest.spyOn(pipeline, 'createArticleMessage')
        .mockResolvedValue(articleMessage)
      await pipeline.deliver(NewArticle())
      expect(sendNewArticle)
        .toHaveBeenCalled()
    })
    it('handles errors', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const articleMessage = {
        passedFilters: () => true
      }
      const error = new Error('deadgf')
      jest.spyOn(pipeline, 'sendNewArticle')
        .mockRejectedValue(error)
      const handleArticleFailure = jest.spyOn(pipeline, 'handleArticleFailure')
      jest.spyOn(pipeline, 'createArticleMessage')
        .mockResolvedValue(articleMessage)
      await pipeline.deliver(NewArticle())
      expect(handleArticleFailure)
        .toHaveBeenCalled()
    })
  })
  describe('handleArticleBlocked', () => {
    beforeEach(() => {
      config.get.mockReturnValue({
        log: {
          unfiltered: false
        },
        apis: {
          pledge: {},
          discordHttpGateway: {}
        }
      })
    })
    it('records the filter block', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const recordFilterBlock = jest.spyOn(pipeline, 'recordFilterBlock')
      const newArticle = NewArticle()
      await pipeline.handleArticleBlocked(newArticle)
      expect(recordFilterBlock).toHaveBeenCalledWith(newArticle)
    })
  })
  describe('handleArticleFailure', () => {
    beforeEach(() => {
      jest.spyOn(DeliveryPipeline.prototype, 'getChannel')
        .mockReturnValue({})
    })
    it('records the failure', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const recordFailure = jest.spyOn(pipeline, 'recordFailure')
      const newArticle = NewArticle()
      await pipeline.handleArticleFailure(newArticle, new Error('atwegq'))
      expect(recordFailure).toHaveBeenCalledTimes(1)
    })
    it('sends the error if error code 50035', async () => {
      const pipeline = new DeliveryPipeline(Bot())
      const channel = {
        send: jest.fn()
      }
      jest.spyOn(pipeline, 'getChannel')
        .mockReturnValue(channel)
      const newArticle = NewArticle()
      const error = new Error('srfx')
      error.code = 50035
      await pipeline.handleArticleFailure(newArticle, error)
      expect(channel.send).toHaveBeenCalledTimes(1)
    })
  })
  describe('sendNewArticle', () => {
    const enqueue = jest.fn()
    beforeEach(() => {
      jest.spyOn(DeliveryPipeline.prototype, 'getQueueForChannel')
        .mockReturnValue({
          enqueue
        })
      enqueue.mockReset()
    })
    it('enqueues the article if medium is found', async () => {
      const bot = Bot()
      const pipeline = new DeliveryPipeline(bot)
      const newArticle = NewArticle()
      const articleMessage = {
        foo: 'baz',
        getMedium: jest.fn().mockResolvedValue({}),
      }

      await pipeline.sendNewArticle(newArticle, articleMessage)
      expect(enqueue)
        .toHaveBeenCalledWith(newArticle, articleMessage)
    })
    it('does not enqueue the article if medium is missing', async () => {
      const bot = Bot()
      const pipeline = new DeliveryPipeline(bot)
      const newArticle = NewArticle()
      const articleMessage = {
        foo: 'baz',
        getMedium: jest.fn().mockResolvedValue(null),
      }

      await pipeline.sendNewArticle(newArticle, articleMessage)
      expect(enqueue).not.toHaveBeenCalled()
    })
  })
  describe('record functions', () => {
    const original = DeliveryRecord.Model
    const modelSave = jest.fn()
    beforeEach(() => {
      DeliveryRecord.Model = jest.fn()
        .mockReturnValue({
          save: modelSave
        })
      modelSave.mockReset()
    })
    afterEach(() => {
      DeliveryRecord.Model = original
    })
    describe('recordFailure', () => {
      it('creates and saves the model', async () => {
        const pipeline = new DeliveryPipeline(Bot())
        const newArticle = {
          article: {
            _id: 'abc'
          },
          feedObject: {
            channel: 'abaa',
            url: 'someurl'
          }
        }
        const errorMessage = '53e47yu'
        await pipeline.recordFailure(newArticle, errorMessage)
        expect(DeliveryRecord.Model).toHaveBeenCalledWith({
          articleID: newArticle.article._id,
          feedURL: newArticle.feedObject.url,
          channel: newArticle.feedObject.channel,
          delivered: false,
          comment: errorMessage
        })
        expect(modelSave).toHaveBeenCalledTimes(1)
      })
      it('does not create model if not mongodb', async () => {
        Feed.isMongoDatabase = false
        const pipeline = new DeliveryPipeline(Bot())
        const newArticle = {
          article: {
            _id: 'abc'
          },
          feedObject: {
            url: 'bla',
            channel: 'abaa'
          }
        }
        const error = new Error('sewtryd')
        await pipeline.recordFailure(newArticle, error)
        expect(DeliveryRecord.Model).not.toHaveBeenCalled()
        expect(modelSave).not.toHaveBeenCalled()
        Feed.isMongoDatabase = true
      })
    })
    describe('recordFilterBlock', () => {
      it('works', async () => {
        const pipeline = new DeliveryPipeline(Bot())
        const newArticle = {
          article: {
            _id: 'abc'
          },
          feedObject: {
            channel: 'abaa',
            url: 'feedurl'
          }
        }
        await pipeline.recordFilterBlock(newArticle)
        expect(DeliveryRecord.Model).toHaveBeenCalledWith({
          articleID: newArticle.article._id,
          feedURL: newArticle.feedObject.url,
          channel: newArticle.feedObject.channel,
          delivered: false,
          comment: 'Blocked by filters'
        })
        expect(modelSave).toHaveBeenCalledTimes(1)
      })
      it('does not create model if not mongodb', async () => {
        Feed.isMongoDatabase = false
        const pipeline = new DeliveryPipeline(Bot())
        const newArticle = {
          article: {
            _id: 'abc'
          },
          feedObject: {
            channel: 'abaa',
            url: 'feedurl'
          }
        }
        await pipeline.recordFilterBlock(newArticle)
        expect(DeliveryRecord.Model).not.toHaveBeenCalled()
        expect(modelSave).not.toHaveBeenCalled()
        Feed.isMongoDatabase = true
      })
    })
  })
})
