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
    it('getFeeds works', async function () {
      const feedIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      ]
      const guildData = {
        _id: 'abce4y6t',
        name: 'some name'
      }
      const profile = new GuildProfile(guildData)
      await profile.save()
      const promises = []
      for (const feedId of feedIds) {
        const data = {
          _id: feedId,
          channel: '1',
          guild: guildData._id,
          url: 'ab',
          title: '24r'
        }
        promises.push(mongoose.connection.db.collection('feeds').insertOne(data))
      }
      await Promise.all(promises)
      const retrieved = await profile.getFeeds()
      expect(retrieved).toHaveLength(2)
      expect(retrieved[0].id).toEqual(feedIds[0].toHexString())
      expect(retrieved[1].id).toEqual(feedIds[1].toHexString())
    })
    it('delete also deletes other feeds', async function () {
      const guildData = {
        _id: '2q35rrftjtyre',
        name: 'dszgehrf'
      }
      const profile = new GuildProfile(guildData)
      await profile.save()
      const feedIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      ]
      const promises = []
      for (const feedId of feedIds) {
        const data = {
          _id: feedId,
          channel: '1',
          guild: guildData._id,
          url: 'ab',
          title: '24r'
        }
        promises.push(mongoose.connection.db.collection('feeds').insertOne(data))
      }
      await Promise.all(promises)
      const found = await FeedModel.find({ guild: guildData._id }).exec()
      expect(found).toHaveLength(2)
      await profile.delete()
      await expect(FeedModel.find({ guild: guildData._id }).exec())
        .resolves.toEqual([])
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})

