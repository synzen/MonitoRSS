const mongoose = require('mongoose')
const config = require('../../config.js')
const initialize = require('../../initialization/index.js')
const GeneralStats = require('../../models/GeneralStats.js')
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
    await con.db.dropDatabase()
    jest.spyOn(config, 'get')
      .mockReturnValue({
        database: {
          uri: 'mongodb://'
        }
      })
  })
  afterEach(() => {
    ArticleRateLimiter.sent = 0
    ArticleRateLimiter.blocked = 0
  })
  describe('updateArticlesSent', () => {
    it('inserts correctly', async () => {
      ArticleRateLimiter.sent = 10
      await ArticleRateLimiter.updateArticlesSent()
      const found = await con.db.collection(GeneralStats.Model.collection.name).findOne({
        _id: GeneralStats.TYPES.ARTICLES_SENT
      })
      expect(found).toBeDefined()
      expect(found.data).toEqual(10)
      expect(found.addedAt).toBeDefined()
    })
    it('updates correctly', async () => {
      ArticleRateLimiter.sent = 2
      await con.db.collection(GeneralStats.Model.collection.name).insertOne({
        _id: GeneralStats.TYPES.ARTICLES_SENT,
        data: 2
      })
      await ArticleRateLimiter.updateArticlesSent()
      const found = await con.db.collection(GeneralStats.Model.collection.name).findOne({
        _id: GeneralStats.TYPES.ARTICLES_SENT
      })
      expect(found).toBeDefined()
      expect(found.data).toEqual(4)
    })
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
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
