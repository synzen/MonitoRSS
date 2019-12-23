const mongoose = require('mongoose')
const Feed = require('../../../models/Feed.js').model
const GuildProfile = require('../../../models/GuildProfile.js').model
const dbName = 'test_int_middleware_guildprofile'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}

describe('Int::models/middleware/Feed', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  it('it adds the feed id to the guild when feed is saved', async function () {
    const guildData = {
      _id: new mongoose.Types.ObjectId(),
      name: 'guild'
    }
    const feedData = {
      title: 'abc',
      url: 'asd',
      guild: guildData._id,
      channel: '123'
    }
    const guild = new GuildProfile(guildData)
    const guildDoc = await guild.save()
    feedData.guild = guildDoc._id
    const feed = new Feed(feedData)
    const feedDoc = await feed.save()
    const foundGuild = await GuildProfile.findById(guildData._id.toHexString()).lean().exec()
    expect(foundGuild.feeds).toHaveLength(1)
    expect(foundGuild.feeds[0].toHexString()).toEqual(feedDoc._id.toHexString())
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
