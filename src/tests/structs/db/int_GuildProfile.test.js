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
    it('works', async function () {
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
      const feedIds = results.map(doc => doc._id)
      const freshProfile = await GuildProfile.get(guildData._id)
      expect(freshProfile.feeds).toEqual(feedIds)
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
