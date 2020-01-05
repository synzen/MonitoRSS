process.env.TEST_ENV = true
const config = require('../../../config.js')
const Article = require('../../../models/Article.js')
const Feed = require('../../../structs/db/Feed.js')
const mongoose = require('mongoose')
const dbName = 'test_int_pruneCollections'
const pruneCollections = require('../../../util/maintenance/pruneCollections.js')
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js')

describe('Int::util/maintenance/pruneCollections', function () {
  beforeAll(async function () {
    config.database.uri = 'mongodb://'
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
  })
  it('drops unused collections', async function () {
    const db = mongoose.connection.db
    const feeds = [{
      title: 'title1',
      url: 'https://www.url1.com',
      guild: 'guild1',
      channel: 'channel1'
    }, {
      title: 'title2',
      url: 'https://www.url2.com',
      guild: 'guild2',
      channel: 'channel2'
    }, {
      title: 'title3',
      url: 'https://www.url3.com',
      guild: 'guild3',
      channel: 'channel3'
    }]
    const guildIdsByShard = new Map([['guild1', 0], ['guild2', 1]])
    const feed1 = new Feed(feeds[0])
    const feed2 = new Feed(feeds[1])
    const feed3 = new Feed(feeds[2])
    const [ schedule1, schedule2 ] = await Promise.all([
      feed1.determineSchedule(),
      feed2.determineSchedule(),
    ])
    const schedule3 = await feed3.determineSchedule()
    const feed1Collection = Article.getCollectionID(feed1.url, guildIdsByShard.get(feed1.guild), schedule1)
    const feed2Collection = Article.getCollectionID(feed2.url, guildIdsByShard.get(feed2.guild), schedule2)
    // Feeed 3 is not in guild ids, thus this collection should be deleted
    const feed3Collection = Article.getCollectionID(feed3.url, 10, schedule3)
    await Promise.all([
      db.collection('feeds').insertMany(feeds),
      db.collection(feed1Collection).insertOne({
        title: 'whatever'
      }),
      db.collection(feed2Collection).insertOne({
        title: 'whatever'
      }),
      db.collection('123unused').insertOne({
        title: 'whatever'
      })
    ])
    await db.collection(feed3Collection).insertOne({
      title: 'whatever'
    })
    const allCollections = await db.listCollections().toArray()
    expect(allCollections.map(c => c.name))
      .toEqual(expect.arrayContaining([feed1Collection, feed2Collection, feed3Collection, '123unused']))

    // Now assert
    await pruneCollections(guildIdsByShard)
    const remainingCollections = await db.listCollections().toArray()
    expect(remainingCollections.map(c => c.name))
      .toEqual(expect.arrayContaining([feed1Collection, feed2Collection]))
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
