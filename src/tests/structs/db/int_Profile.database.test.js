process.env.TEST_ENV = true
const Profile = require('../../../structs/db/Profile.js')
const mongoose = require('mongoose')
const config = require('../../../config.js')
const dbName = 'test_int_Profile'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js')

describe('Int::structs/db/Profile Database', function () {
  beforeAll(async function () {
    config.database.uri = 'mongodb://'
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
      const profile = new Profile(guildData)
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
      expect(retrieved[0]._id).toEqual(feedIds[0].toHexString())
      expect(retrieved[1]._id).toEqual(feedIds[1].toHexString())
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
