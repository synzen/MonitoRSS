const FeedModel = require('../../../models/Feed.js').model
const mongoose = require('mongoose')

const dbName = 'test_int_middleware_feed'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::models/middleware/Feed', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  it('throws an error if feed tries to change guild', async function () {
    const id = 'wq23etr54ge5hu'
    const guildId = new mongoose.Types.ObjectId()
    const newGuildId = new mongoose.Types.ObjectId()
    await mongoose.connection.db.collection('feeds').insertOne({
      id,
      title: 'aedsg',
      channel: 'sewry',
      url: 'asedwt',
      guild: guildId
    })
    const feed = await FeedModel.findOne({ id }).exec()
    feed.guild = newGuildId.toHexString()
    await expect(feed.save())
      .rejects.toThrow('Guild cannot be changed')
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
