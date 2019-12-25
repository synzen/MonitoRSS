const GuildProfile = require('../../../structs/db/GuildProfile.js')
const FeedModel = require('../../../models/Feed.js').model
const mongoose = require('mongoose')
const dbName = 'test_int_guildprofile'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::structs/db/GuildProfile', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  describe('getFeeds', function () {
    it('middleware works', async function () {
      const guildData = { _id: '12345rfge3', name: 'hoasd' }
      const profile = new GuildProfile(guildData)
      await profile.save()
      const feedData = {
        title: 'ab',
        url: 'asd',
        guild: guildData._id,
        channel: 'aqetwg'
      }
      const feedData2 = {
        title: 'abdfhgtn',
        url: 'asdgfnj',
        guild: guildData._id,
        channel: 'aqetwggyjhn'
      }
      const feed = new FeedModel(feedData)
      const feed2 = new FeedModel(feedData2)
      const results = await Promise.all([ feed.save(), feed2.save() ])
      const feedIds = results.map(doc => doc._id.toHexString())
      const freshProfile = await GuildProfile.get(guildData._id)
      expect(freshProfile.feeds).toEqual(feedIds)
    })
    it('getFeeds works', async function () {
      const feedIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      ]
      const guildData = {
        _id: 'abce4y6t',
        name: 'some name',
        feeds: feedIds.map(id => id.toHexString())
      }
      const profile = new GuildProfile(guildData)
      await profile.save()
      for (const feedId of feedIds) {
        const data = {
          _id: feedId,
          channel: '1',
          guild: guildData._id,
          url: 'ab',
          title: '24r'
        }
        await mongoose.connection.db.collection('feeds').insertOne(data)
      }
      const retrieved = await profile.getFeeds()
      expect(retrieved).toHaveLength(2)
      expect(retrieved[0].id).toEqual(feedIds[0].toHexString())
      expect(retrieved[1].id).toEqual(feedIds[1].toHexString())
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
