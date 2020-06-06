const FeedModel = require('../../../models/Feed.js')
const intitialize = require('../../../initialization/index.js')
const mongoose = require('mongoose')

const dbName = 'test_int_middleware_feed'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

describe('Int::models/middleware/Feed', function () {
  let con
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await con.db.dropDatabase()
    await intitialize.setupModels(con)
  })
  it('throws an error if feed tries to change guild', async function () {
    const id = 'wq23etr54ge5hu'
    const guildId = new mongoose.Types.ObjectId()
    const newGuildId = new mongoose.Types.ObjectId()
    await con.db.collection('feeds').insertOne({
      id,
      title: 'aedsg',
      channel: 'sewry',
      url: 'asedwt',
      guild: guildId
    })
    const feed = await FeedModel.Model.findOne({ id }).exec()
    feed.guild = newGuildId.toHexString()
    await expect(feed.save())
      .rejects.toThrow('Guild cannot be changed')
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
