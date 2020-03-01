process.env.TEST_ENV = true
const mongoose = require('mongoose')
const dbName = 'test_int_checkIndexes'
const checkArticleIndexes = require('../../maintenance/checkArticleIndexes.js')
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

describe('Int::maintenance/checkArticleIndexes', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
  })
  beforeEach(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.collection('articles').insertOne({
      addedAt: new Date()
    })
  })
  it('drops the the index if articles expire is 0', async function () {
    await mongoose.connection.collection('articles').createIndex({
      addedAt: 1
    }, {
      expireAfterSeconds: 86400 * 1 // 1 day
    })
    await expect(mongoose.connection.collection('articles')
      .indexExists('addedAt_1')).resolves.toEqual(true)
    await checkArticleIndexes(0)
    await expect(mongoose.connection.collection('articles')
      .indexExists('addedAt_1')).resolves.toEqual(false)
  })
  it('changes the index if config changed', async function () {
    const index = {
      addedAt: 1
    }
    const indexOptions = {
      expireAfterSeconds: 86400 * 3 // 3 days
    }
    await mongoose.connection.collection('articles')
      .createIndex(index, indexOptions)
    await checkArticleIndexes(10)
    const newIndexes = await mongoose.connection.collection('articles').indexes()
    expect(newIndexes.find(idx => idx.name === 'addedAt_1').expireAfterSeconds)
      .toEqual(86400 * 10)
  })
  it('creates the index if articles expire is greater than 0', async function () {
    await checkArticleIndexes(9)
    await expect(mongoose.connection.collection('articles')
      .indexExists('addedAt_1')).resolves.toEqual(true)
    await mongoose.connection.collection('articles').dropIndexes()
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
