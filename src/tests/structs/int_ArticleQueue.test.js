const mongoose = require('mongoose')
const config = require('../../config.js')
const initialize = require('../../initialization/index.js')
const GeneralStats = require('../../models/GeneralStats.js')
const ArticleQueue = require('../../structs/ArticleQueue.js')
const dbName = 'test_int_articlequeue'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../config.js')

describe('Int::structs/ArticleQueue', function () {
  /** @type {import('mongoose').Connection} */
  let con
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
    jest.useFakeTimers()
  })
  beforeEach(async () => {
    await con.db.dropDatabase()
    jest.resetAllMocks()
    jest.useFakeTimers()
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
    ArticleQueue.sent = 0
    ArticleQueue.blocked = 0
  })
  describe('updateArticlesSent', () => {
    it('inserts correctly', async () => {
      ArticleQueue.sent = 10
      await ArticleQueue.updateArticlesSent()
      const found = await con.db.collection(GeneralStats.Model.collection.name).findOne({
        _id: GeneralStats.TYPES.ARTICLES_SENT
      })
      expect(found).toBeDefined()
      expect(found.data).toEqual(10)
      expect(found.addedAt).toBeDefined()
    })
    it('updates correctly', async () => {
      ArticleQueue.sent = 2
      await con.db.collection(GeneralStats.Model.collection.name).insertOne({
        _id: GeneralStats.TYPES.ARTICLES_SENT,
        data: 2
      })
      await ArticleQueue.updateArticlesSent()
      const found = await con.db.collection(GeneralStats.Model.collection.name).findOne({
        _id: GeneralStats.TYPES.ARTICLES_SENT
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
