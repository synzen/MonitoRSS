process.env.TEST_ENV = true
const mongoose = require('mongoose')
const initialize = require('../../initialization/index.js')
const checkArticleIndexes = require('../../maintenance/checkArticleIndexes.js')
const dbName = 'test_int_checkIndexes'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  autoIndex: false
}

jest.mock('../../config.js', () => ({
  get: () => ({
    database: {
      uri: 'mongodb://'
    }
  })
}))

describe('Int::maintenance/checkArticleIndexes', function () {
  /** @type {import('mongoose').Connection} */
  let con
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
    await con.collection('articles').insertOne({
      addedAt: new Date()
    })
  })
  it('drops the the index if articles expire is 0', async function () {
    await con.collection('articles').createIndex({
      addedAt: 1
    }, {
      expireAfterSeconds: 86400 * 1 // 1 day
    })
    await expect(con.collection('articles')
      .indexExists('addedAt_1')).resolves.toEqual(true)
    await checkArticleIndexes(0)
    await expect(con.collection('articles')
      .indexExists('addedAt_1')).resolves.toEqual(false)
  })
  it('changes the index if config changed', async function () {
    const index = {
      addedAt: 1
    }
    const indexOptions = {
      expireAfterSeconds: 86400 * 3 // 3 days
    }
    await con.collection('articles')
      .createIndex(index, indexOptions)
    await checkArticleIndexes(10)
    const newIndexes = await con.collection('articles').indexes()
    expect(newIndexes.find(idx => idx.name === 'addedAt_1').expireAfterSeconds)
      .toEqual(86400 * 10)
  })
  it('creates the index if articles expire is greater than 0', async function () {
    await checkArticleIndexes(9)
    await expect(con.collection('articles')
      .indexExists('addedAt_1')).resolves.toEqual(true)
    await con.collection('articles').dropIndexes()
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
