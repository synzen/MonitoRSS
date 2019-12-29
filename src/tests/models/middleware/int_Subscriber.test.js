const SubscriberModel = require('../../../models/Subscriber.js').model
const mongoose = require('mongoose')
// Require to register the model for middleware
require('../../../models/Feed.js')

const dbName = 'test_int_middleware_subscriber'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::models/middleware/Subscriber', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  it(`throws an error if the feed does not exist`, async function () {
    const subscriber = new SubscriberModel({
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
      mongoose.connection.db.collection('subscribers').insertOne({
        id,
        type: 'role',
        feed: feedId
      }),
      mongoose.connection.db.collection('feeds').insertOne({
        _id: feedId
      }),
      mongoose.connection.db.collection('feeds').insertOne({
        _id: newFeedId
      })
    ])

    const doc = await SubscriberModel.findOne({ id })
    const subscriber = new SubscriberModel(doc, true)
    subscriber.feed = newFeedId.toHexString()
    await expect(subscriber.save())
      .rejects.toThrow('Feed cannot be changed')
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
