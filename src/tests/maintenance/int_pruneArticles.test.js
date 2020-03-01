process.env.TEST_ENV = true
const config = require('../../config.js')
const mongoose = require('mongoose')
const dbName = 'test_int_pruneArticles'
const pruneArticles = require('../../maintenance/pruneArticles.js')
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../config.js')

describe('Int::maintenance/pruneArticles', function () {
  beforeAll(async function () {
    config.database.uri = 'mongodb://'
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
  })
  beforeEach(async function () {
    await mongoose.connection.db.dropDatabase()
  })
  it('removes irrelevant articles for default schedule', async function () {
    const db = mongoose.connection.db
    const articles = [{
      // This should be removed since no feeds match this
      id: '1',
      feedURL: 'url1',
      shardID: 8,
      scheduleName: 'default'
    }, {
      // This should not be removed
      id: '2',
      feedURL: 'url2',
      shardID: 8,
      scheduleName: 'default'
    }, {
      // This should be removed since no feeds match this
      id: '3',
      feedURL: 'url3',
      shardID: 9,
      scheduleName: 'default'
    }]
    await db.collection('articles').insertMany(articles)
    await db.collection('schedules').insertOne({
      name: 'default',
      refreshRateMinutes: 10
    })
    await db.collection('feeds').insertMany([{
      channel: 'irrelevant',
      url: 'url2',
      guild: 'guild1'
    }])
    const guildIdsByShard = new Map([
      ['guild1', 8]
    ])
    await pruneArticles.pruneArticles(guildIdsByShard)
    const all = await db.collection('articles').find({}).toArray()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual(expect.objectContaining(articles[1]))
  })
  it('removes irrelevant articles including other schedules', async function () {
    const db = mongoose.connection.db
    const articles = [{
      // This should be removed since no schedules exist for this
      id: '1',
      feedURL: 'url2',
      shardID: 8,
      scheduleName: 'vip'
    }, {
      // Thus should not be removed since a schedule matches
      id: '2',
      feedURL: 'url3',
      shardID: 8,
      scheduleName: 'vip'
    }]
    const schedules = [{
      name: 'default',
      refreshRateMinutes: 10
    }, {
      name: 'vip',
      keywords: 'url3',
      refreshRateMinutes: 1
    }]
    const feeds = [{
      channel: 'irrelevant',
      url: 'url2',
      guild: 'guild1'
    }, {
      channel: 'irrelevant',
      url: 'url3',
      guild: 'guild2'
    }]
    const guildIdsByShard = new Map([
      ['guild1', 8],
      ['guild2', 8]
    ])
    await db.collection('articles').insertMany(articles)
    await db.collection('schedules').insertMany(schedules)
    await db.collection('feeds').insertMany(feeds)
    await pruneArticles.pruneArticles(guildIdsByShard)
    const all = await db.collection('articles').find({}).toArray()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual(expect.objectContaining(articles[1]))
    // expect(all).toHaveLength(0)
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
