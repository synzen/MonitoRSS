const mongoose = require('mongoose')
const initialize = require('../../initialization/index.js')
const checkIndexes = require('../../maintenance/checkIndexes.js')
const Article = require('../../models/Article.js')
const DeliveryRecord = require('../../models/DeliveryRecord.js')
const config = require('../../config.js')
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

describe('Int::maintenance/checkIndexes', function () {
  /** @type {import('mongoose').Connection} */
  let con
  let articleCollectionName
  let deliveryRecordCollectionName
  const indexName = 'addedAt_1'
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
    articleCollectionName = Article.Model.collection.name
    deliveryRecordCollectionName = DeliveryRecord.Model.collection.name
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
    await con.collection(articleCollectionName).insertOne({
      addedAt: new Date()
    })
    await con.collection(deliveryRecordCollectionName).insertOne({
      addedAt: new Date()
    })
    await con.collection(articleCollectionName).dropIndexes()
    await con.collection(deliveryRecordCollectionName).dropIndexes()
  })
  it('drops the the index if articles expire is 0', async function () {
    await con.collection(articleCollectionName).createIndex({
      addedAt: 1
    }, {
      expireAfterSeconds: 86400 * 1 // 1 day
    })
    await expect(con.collection(articleCollectionName)
      .indexExists(indexName)).resolves.toEqual(true)
    jest.spyOn(config, 'get').mockReturnValue({
      database: {
        uri: 'mongodb://',
        articlesExpire: 0
      }
    })
    await checkIndexes.checkIndexes()
    await expect(con.collection(articleCollectionName)
      .indexExists(indexName)).resolves.toEqual(false)
  })
  it('changes the index if config changed', async function () {
    const index = {
      addedAt: 1
    }
    const indexOptions = {
      expireAfterSeconds: 86400 * 3 // 3 days
    }
    await con.collection(articleCollectionName)
      .createIndex(index, indexOptions)
    jest.spyOn(config, 'get').mockReturnValue({
      database: {
        uri: 'mongodb://',
        articlesExpire: 10
      }
    })
    await checkIndexes.checkIndexes()
    const newIndexes = await con.collection(articleCollectionName).indexes()
    expect(newIndexes.find(idx => idx.name === indexName).expireAfterSeconds)
      .toEqual(86400 * 10)
  })
  it.skip('creates the index if articles expire is greater than 0', async function () {
    jest.spyOn(config, 'get').mockReturnValue({
      database: {
        uri: 'mongodb://',
        articlesExpire: 9
      }
    })
    await con.collection(articleCollectionName).dropIndexes('addedAt_1')
    await con.collection(deliveryRecordCollectionName).dropIndexes('addedAt_1')
    await checkIndexes.checkArticleIndexes()
    await expect(con.collection(articleCollectionName)
      .indexExists(indexName)).resolves.toEqual(true)
  })
  it.skip('creates the index if delivery records expire is greater than 0', async function () {
    jest.spyOn(config, 'get').mockReturnValue({
      database: {
        uri: 'mongodb://',
        deliveryRecordsExpire: 9
      }
    })
    await checkIndexes.checkDeliveryRecordsIndexes()
    await expect(con.collection(deliveryRecordCollectionName)
      .indexExists(indexName)).resolves.toEqual(true)
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
