const SubscriberModel = require('../../../models/Subscriber.js')
const initialize = require('../../../initialization/index.js')
const mongoose = require('mongoose')

const dbName = 'test_int_middleware_subscriber'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

describe('Int::models/middleware/Subscriber', function () {
  let con
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await con.db.dropDatabase()
    await initialize.setupModels(con)
  })
  it('throws an error if the feed does not exist', async function () {
    const subscriber = new SubscriberModel.Model({
      id: 'asd',
      type: 'role',
      feed: new mongoose.Types.ObjectId().toHexString()
    })

    await expect(subscriber.save())
      .rejects.toThrowError(/specified feed/)
  })
  it('throws an error if subscriber tries to change feed', async function () {
    const id = 'wq23etr54ge5hu'
    const feedId = new mongoose.Types.ObjectId()
    const newFeedId = new mongoose.Types.ObjectId()
    await Promise.all([
      con.db.collection('subscribers').insertOne({
        id,
        type: 'role',
        feed: feedId
      }),
      con.db.collection('feeds').insertOne({
        _id: feedId
      }),
      con.db.collection('feeds').insertOne({
        _id: newFeedId
      })
    ])

    const doc = await SubscriberModel.Model.findOne({ id })
    const subscriber = new SubscriberModel.Model(doc, true)
    subscriber.feed = newFeedId.toHexString()
    await expect(subscriber.save())
      .rejects.toThrow('Feed cannot be changed')
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
