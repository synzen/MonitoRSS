const Subscriber = require('../../../structs/db/Subscriber.js')
const mongoose = require('mongoose')
const dbName = 'test_int_guildprofile'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::structs/db/GuildProfile Database', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  it('saves properly', async function () {
    const feedId = new mongoose.Types.ObjectId()
    const feedData = {
      _id: feedId
    }
    await mongoose.connection.db.collection('feeds').insertOne(feedData)
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
    const found = await mongoose.connection.db.collection('subscribers').findOne({
      feed: feedId
    })
    expect(JSON.parse(JSON.stringify(found))).toEqual(expect.objectContaining(subData))
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
