const Feed = require('../../../structs/db/Feed.js')
const FeedModel = require('../../../models/Feed.js').model
const FormatModel = require('../../../models/Format.js').model
require('../../../models/GuildProfile.js')
const mongoose = require('mongoose')
const dbName = 'test_int_feed'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::structs/db/Feed Database', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  describe('getFormat', function () {
    it('works', async function () {
      const feedId = new mongoose.Types.ObjectId()
      const formatData = {
        text: 'abc',
        feed: feedId
      }
      const feedData = {
        title: 'abc',
        url: 'asdf',
        guild: 'asdf',
        channel: 'sdxgdh',
        _id: feedId
      }
      await new FormatModel(formatData).save()
      await mongoose.connection.db.collection('feeds').insertOne(feedData)
      const feed = await Feed.get(feedId.toHexString())
      const format = await feed.getFormat()
      expect(format).not.toBeNull()
      expect(format.text).toEqual(formatData.text)
      expect(format.feed).toEqual(formatData.feed.toHexString())
    })
  })
  it('saves and updates with filters', async function () {
    const guild = 'swrye57'
    await mongoose.connection.db.collection('guilds').insertOne({
      _id: guild
    })
    const feedData = {
      title: 'abc',
      url: 'asdf',
      guild,
      channel: 'sdxgdh',
      filters: {
        title: ['a', 'b']
      }
    }
    const feed = new Feed(feedData)
    await feed.save()
    const found = await FeedModel.findById(feed._id).lean().exec()
    expect(found.filters).toEqual(feedData.filters)
    feed.filters.description = []
    feed.filters.description.push('a')
    delete feed.filters.title
    await feed.save()
    const foundAgain = await FeedModel.findById(feed._id).lean().exec()
    expect(foundAgain.filters).toEqual({
      description: ['a']
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
