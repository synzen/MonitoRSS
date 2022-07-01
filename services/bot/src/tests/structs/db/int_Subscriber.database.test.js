process.env.TEST_ENV = true
const Subscriber = require('../../../structs/db/Subscriber.js')
const initialize = require('../../../initialization/index.js')
const mongoose = require('mongoose')
const dbName = 'test_int_subscriber'
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

describe('Int::structs/db/subscriber Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
  })
  it('saves properly', async function () {
    const feedId = new mongoose.Types.ObjectId()
    const feedData = {
      _id: feedId
    }
    await con.db.collection('feeds').insertOne(feedData)
    const subData = {
      feed: feedId.toHexString(),
      id: '3etwg',
      type: 'role',
      filters: {
        title: ['hzz', 'hg'],
        de: ['e4', 'sgd']
      }
    }
    const subscriber = new Subscriber(subData)
    await subscriber.save()
    const found = await con.db.collection('subscribers').findOne({
      feed: feedId
    })
    expect(JSON.parse(JSON.stringify(found))).toEqual(expect.objectContaining(subData))
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
