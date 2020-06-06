process.env.TEST_ENV = true
const Feed = require('../../../structs/db/Feed.js')
const FeedModel = require('../../../models/Feed.js')
const FilteredFormatModel = require('../../../models/FilteredFormat.js')
const SubscriberModel = require('../../../models/Subscriber.js')
const mongoose = require('mongoose')
const initialize = require('../../../initialization/index.js')
const dbName = 'test_int_feed'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  autoIndex: false
}

jest.mock('../../../config.js', () => ({
  get: () => ({
    database: {
      uri: 'mongodb://'
    }
  })
}))

describe('Int::structs/db/Feed Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
    collection = con.db.collection('feeds')
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
  })
  describe('getSubscribers', function () {
    it('works', async function () {
      const feedId = new mongoose.Types.ObjectId()
      const subscriberData = {
        type: 'role',
        id: '23',
        feed: feedId
      }
      const subscriberData2 = {
        type: 'role',
        id: '234',
        feed: feedId
      }
      const feedData = {
        title: 'absgrfc',
        url: 'asdffjy',
        guild: 'asdfyghfj',
        channel: 'sdxgdhj',
        _id: feedId
      }
      await con.collection('subscribers').insertMany([
        subscriberData,
        subscriberData2
      ])
      await con.db.collection('feeds').insertOne(feedData)
      const feed = await Feed.get(feedId.toHexString())
      const subscribers = await feed.getSubscribers()
      expect(subscribers).toHaveLength(2)
      expect(subscribers[0].data).toEqual(expect.objectContaining(JSON.parse(JSON.stringify(subscriberData))))
      expect(subscribers[1].data).toEqual(expect.objectContaining(JSON.parse(JSON.stringify(subscriberData2))))
    })
  })
  it('saves and updates with filters', async function () {
    const guild = 'swrye57'
    await con.db.collection('guilds').insertOne({
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
    const found = await collection.findOne({
      _id: new mongoose.Types.ObjectId(feed._id)
    })
    expect(found.filters).toEqual(feedData.filters)
    feed.filters.description = []
    feed.filters.description.push('a')
    delete feed.filters.title
    await feed.save()
    const foundAgain = await collection.findOne({
      _id: new mongoose.Types.ObjectId(feed._id)
    })
    expect(foundAgain.filters).toEqual({
      description: ['a']
    })
  })
  it('deletes associated format and subscribers on delete', async function () {
    const guildId = new mongoose.Types.ObjectId()
    const feedId = new mongoose.Types.ObjectId()
    const db = con.db
    await Promise.all([
      db.collection('guilds').insertOne({
        _id: guildId.toHexString()
      }),
      db.collection('filtered_formats').insertOne({
        text: 'sde',
        feed: feedId
      }),
      db.collection('subscribers').insertOne({
        id: 'af',
        type: 'role',
        feed: feedId
      }),
      db.collection('subscribers').insertOne({
        id: 'aed',
        type: 'role',
        feed: feedId
      }),
      collection.insertOne({
        _id: feedId,
        guild: guildId.toHexString(),
        title: 'asd',
        channel: 'se',
        url: 'srfhy'
      })
    ])

    const doc = await FeedModel.Model.findById(feedId).exec()
    await expect(FilteredFormatModel.Model.find({ feed: feedId.toHexString() }))
      .resolves.toHaveLength(1)
    await expect(SubscriberModel.Model.find({ feed: feedId.toHexString() }))
      .resolves.toHaveLength(2)
    const feed = new Feed(doc, true)
    await feed.delete()
    await expect(db.collection('subscribers').find({ feed: feedId })
      .toArray())
      .resolves.toHaveLength(0)
    await expect(db.collection('filtered_formats').find({ feed: feedId })
      .toArray())
      .resolves.toHaveLength(0)
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
