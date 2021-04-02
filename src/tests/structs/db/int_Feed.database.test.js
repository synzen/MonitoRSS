process.env.TEST_ENV = true
const Feed = require('../../../structs/db/Feed.js')
const Supporter = require('../../../structs/db/Supporter.js')
const FeedModel = require('../../../models/Feed.js')
const FilteredFormatModel = require('../../../models/FilteredFormat.js')
const SubscriberModel = require('../../../models/Subscriber.js')
const mongoose = require('mongoose')
const initialize = require('../../../initialization/index.js')
const dbName = 'test_int_feed'
const config = require('../../../config.js')
const Schedule = require('../../../structs/db/Schedule.js')
const Patron = require('../../../structs/db/Patron.js')
const Guild = require('../../../structs/Guild.js')
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  autoIndex: false
}

jest.mock('../../../config.js', () => ({
  get: jest.fn()
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
    jest.resetAllMocks()
    await con.db.dropDatabase()
    config.get.mockReturnValue({
      database: {
        uri: 'mongodb://'
      }
    })
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
  describe('determineSchedule', function () {
    it('returns supporter schedule for supporters', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        },
        apis: {
          pledge: {}
        },
        feeds: {}
      })
      const guildID = 'w246y3r5eh'
      const schedules = [{
        name: 'default',
        refreshRateMinutes: 99
      }]
      const supporters = [{
        _id: 'a',
        guilds: [guildID]
      }]
      await con.db.collection(Schedule.Model.collection.name).insertMany(schedules)
      await con.db.collection(Supporter.Model.collection.name).insertMany(supporters)
      const feedData = {
        url: 'asdf',
        guild: guildID,
        channel: 'sdxgdh'
      }
      const feed = new Feed(feedData)
      const schedule = await feed.determineSchedule()
      expect(schedule).toEqual(Supporter.schedule)
    })
    it('does not returns supporter schedule for slow supporters', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        }
      })
      const guildID = 'w246y3r5eh'
      const schedules = [{
        name: 'default',
        refreshRateMinutes: 99
      }]
      const supporters = [{
        _id: 'a',
        guilds: [guildID],
        slowRate: true
      }]
      jest.spyOn(Guild.prototype, 'getSubscription').mockResolvedValue(null)
      await con.db.collection(Schedule.Model.collection.name).insertMany(schedules)
      await con.db.collection(Supporter.Model.collection.name).insertMany(supporters)
      const feedData = {
        url: 'asdf',
        guild: guildID,
        channel: 'sdxgdh'
      }
      const feed = new Feed(feedData)
      const schedule = await feed.determineSchedule()
      expect(schedule).toEqual(expect.objectContaining({
        name: 'default'
      }))
    })
    it('does not returns supporter schedule for ineligible patron', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        }
      })
      const guildID = 'w246y3r5eh'
      const schedules = [{
        name: 'default',
        refreshRateMinutes: 99
      }]
      const supporters = [{
        _id: 'a',
        guilds: [guildID],
        patron: true
      }]
      const patron = {
        discord: supporters[0]._id,
        status: Patron.STATUS.ACTIVE,
        pledge: Patron.SLOW_THRESHOLD - 1,
        pledgeLifetime: 0
      }
      await con.db.collection(Schedule.Model.collection.name).insertMany(schedules)
      await con.db.collection(Supporter.Model.collection.name).insertMany(supporters)
      await con.db.collection(Patron.Model.collection.collectionName).insertOne(patron)
      const feedData = {
        url: 'asdf',
        guild: guildID,
        channel: 'sdxgdh'
      }
      const feed = new Feed(feedData)
      const schedule = await feed.determineSchedule()
      expect(schedule).toEqual(expect.objectContaining({
        name: 'default'
      }))
    })
    it('does not returns supporter schedule for eligible patron', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        }
      })
      const guildID = 'w246y3r5eh'
      const schedules = [{
        name: 'default',
        refreshRateMinutes: 99
      }]
      const supporters = [{
        _id: 'a',
        guilds: [guildID],
        patron: true
      }]
      const patron = {
        discord: supporters[0]._id,
        status: Patron.STATUS.ACTIVE,
        pledge: Patron.SLOW_THRESHOLD,
        pledgeLifetime: 0
      }
      await con.db.collection(Schedule.Model.collection.name).insertMany(schedules)
      await con.db.collection(Supporter.Model.collection.name).insertMany(supporters)
      await con.db.collection(Patron.Model.collection.collectionName).insertOne(patron)
      const feedData = {
        url: 'asdf',
        guild: guildID,
        channel: 'sdxgdh'
      }
      const feed = new Feed(feedData)
      const schedule = await feed.determineSchedule()
      expect(schedule).toEqual(Supporter.schedule)
    })
    it('returns supporter schedule if supporter guilds are given', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        }
      })
      const guildID = 'w246y3r5eh'
      const schedules = [{
        name: 'default',
        refreshRateMinutes: 99
      }]
      const supporterGuilds = new Set([guildID])
      await con.db.collection(Schedule.Model.collection.name).insertMany(schedules)
      const feedData = {
        url: 'asdf',
        guild: guildID,
        channel: 'sdxgdh'
      }
      const feed = new Feed(feedData)
      const schedule = await feed.determineSchedule(undefined, supporterGuilds)
      expect(schedule).toEqual(Supporter.schedule)
    })
    it('returns the right schedule with keywords', async function () {
      const feedURL = 'hello world'
      const schedules = [{
        name: 'default',
        refreshRateMinutes: 99
      }, {
        name: 'bloopy',
        refreshRateMinutes: 22,
        keywords: ['hello']
      }]
      await con.db.collection(Schedule.Model.collection.name).insertMany([...schedules])
      const feedData = {
        url: feedURL,
        guild: 'guildID',
        channel: 'sdxgdh'
      }
      const feed = new Feed(feedData)
      const schedule = await feed.determineSchedule()
      expect(schedule).toEqual(expect.objectContaining({
        name: 'bloopy'
      }))
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
