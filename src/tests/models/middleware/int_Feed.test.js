const FeedModel = require('../../../models/Feed.js').model
const mongoose = require('mongoose')
// Require to register the model for middleware
require('../../../models/GuildProfile.js')

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
  it(`throws an error if the guild does not exist`, async function () {
    const feed = new FeedModel({
      title: 'asd',
      url: 'rasdole',
      channel: 'sgrf',
      guild: new mongoose.Types.ObjectId().toHexString()
    })

    await expect(feed.save())
      .rejects.toThrowError(/specified guild/)
  })
  it('throws an error if feed tries to change guild', async function () {
    const id = 'wq23etr54ge5hu'
    const guildId = new mongoose.Types.ObjectId()
    const newGuildId = new mongoose.Types.ObjectId()
    await Promise.all([
      mongoose.connection.db.collection('feeds').insertOne({
        id,
        title: 'aedsg',
        channel: 'sewry',
        url: 'asedwt',
        guild: guildId
      }),
      mongoose.connection.db.collection('guilds').insertOne({
        _id: guildId.toHexString()
      }),
      mongoose.connection.db.collection('guilds').insertOne({
        _id: newGuildId.toHexString()
      })
    ])
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
