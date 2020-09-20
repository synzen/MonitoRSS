const mongoose = require('mongoose')
const config = require('../../config.js')
const initialize = require('../../initialization/index.js')
const GeneralStats = require('../../models/GeneralStats.js')
const DeliveryRecord = require('../../models/DeliveryRecord.js')
const ArticleRateLimiter = require('../../structs/ArticleMessageRateLimiter.js')
const dbName = 'test_int_articlemessageratelimiter'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../config.js')

describe('Unit::structs/DeliveryPipeline', function () {
  /** @type {import('mongoose').Connection} */
  let con
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
  })
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()
    await con.db.dropDatabase()
    jest.spyOn(config, 'get')
      .mockReturnValue({
        database: {
          uri: 'mongodb://'
        },
        feeds: {
          articleDailyChannelLimit: 2
        }
      })
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    ArticleRateLimiter.sent = 0
    ArticleRateLimiter.blocked = 0
  })
  describe('updateArticlesBlocked', () => {
    it('inserts correctly', async () => {
      ArticleRateLimiter.blocked = 10
      await ArticleRateLimiter.updateArticlesBlocked()
      const found = await con.db.collection(GeneralStats.Model.collection.name).findOne({
        _id: GeneralStats.TYPES.ARTICLES_BLOCKED
      })
      expect(found).toBeDefined()
      expect(found.data).toEqual(10)
      expect(found.addedAt).toBeDefined()
    })
    it('updates correctly', async () => {
      ArticleRateLimiter.blocked = 2
      await con.db.collection(GeneralStats.Model.collection.name).insertOne({
        _id: GeneralStats.TYPES.ARTICLES_BLOCKED,
        data: 2
      })
      await ArticleRateLimiter.updateArticlesBlocked()
      const found = await con.db.collection(GeneralStats.Model.collection.name).findOne({
        _id: GeneralStats.TYPES.ARTICLES_BLOCKED
      })
      expect(found).toBeDefined()
      expect(found.data).toEqual(4)
    })
  })
  describe('isAtDailyLimit', () => {
    it('returns true correctly', async () => {
      const channelID = 'channelid'
      const rateLimiter = new ArticleRateLimiter(channelID)
      await con.db.collection(DeliveryRecord.Model.collection.name).insertMany([{
        channel: channelID,
        delivered: true,
        addedAt: new Date()
      }, {
        channel: channelID,
        delivered: true,
        addedAt: new Date()
      }])
      await expect(rateLimiter.isAtDailyLimit())
        .resolves.toEqual(true)
    })
    it('returns false correctly', async () => {
      const channelID = 'channelid'
      const rateLimiter = new ArticleRateLimiter(channelID)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      await con.db.collection(DeliveryRecord.Model.collection.name).insertMany([{
        channel: channelID,
        delivered: true,
        addedAt: yesterday
      }, {
        channel: channelID,
        delivered: true,
        addedAt: yesterday
      }])
      await expect(rateLimiter.isAtDailyLimit())
        .resolves.toEqual(false)
    })
    it('returns false if no limit is set', async () => {
      jest.spyOn(config, 'get')
        .mockReturnValue({
          database: {
            uri: 'mongodb://'
          },
          feeds: {
            articleDailyChannelLimit: 0
          }
        })
      const channelID = 'channelid'
      const rateLimiter = new ArticleRateLimiter(channelID)
      await con.db.collection(DeliveryRecord.Model.collection.name).insertMany([{
        channel: channelID,
        delivered: true,
        addedAt: new Date()
      }])
      await expect(rateLimiter.isAtDailyLimit())
        .resolves.toEqual(false)
    })
    it('returns false if limiter has increased limits', async () => {
      const channelID = 'channelid'
      const rateLimiter = new ArticleRateLimiter(channelID, true)
      await con.db.collection(DeliveryRecord.Model.collection.name).insertMany([{
        channel: channelID,
        delivered: true,
        addedAt: new Date()
      }, {
        channel: channelID,
        delivered: true,
        addedAt: new Date()
      }, {
        channel: channelID,
        delivered: true,
        addedAt: new Date()
      }])
      await expect(rateLimiter.isAtDailyLimit())
        .resolves.toEqual(false)
    })
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
