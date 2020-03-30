process.env.TEST_ENV = true
const mongoose = require('mongoose')
const PendingArticle = require('../../../structs/db/PendingArticle.js')
const initialize = require('../../../util/initialization.js')
const dbName = 'test_int_pendingArticle'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js', () => ({
  get: () => ({
    database: {
      uri: 'mongodb://'
    }
  })
}))

describe('Int::structs/db/PendingArticle Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  /** @type {import('mongoose').Collection} */
  let collection
  let collectionName
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
    collectionName = PendingArticle.Model.collection.collectionName
    collection = con.db.collection(collectionName)
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
  })
  it('saves correctly', async function () {
    const data = {
      article: {
        a: {
          b: {
            c: 1
          }
        }
      }
    }
    const kv = new PendingArticle(data)
    await kv.save()
    const docs = await collection.find({}).toArray()
    expect(docs[0].article).toEqual(expect.objectContaining(data.article))
  })
})
