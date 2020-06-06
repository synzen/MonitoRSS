process.env.TEST_ENV = true
const mongoose = require('mongoose')
const GuildData = require('../../structs/GuildData.js')
const initialize = require('../../initialization/index.js')
const dbName = 'test_int_guilddata'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../config.js', () => ({
  get: () => ({
    database: {
      uri: 'mongodb://'
    }
  })
}))

describe('Int::structs/GuildData Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
  })
  it('restores properly', async function () {
    const feedID1 = new mongoose.Types.ObjectId()
    const feedID2 = new mongoose.Types.ObjectId()
    const profile = {
      _id: '123',
      name: 'whaa'
    }
    const feeds = [{
      _id: feedID1,
      title: 'ha',
      url: 'url',
      guild: '123',
      channel: 'abc',
      embeds: []
    }, {
      _id: feedID2,
      title: 'ha2',
      url: 'url2',
      guild: '123',
      channel: 'abc2',
      embeds: []
    }]
    const filteredFormats = [{
      feed: feedID1,
      text: 'abc',
      embeds: []
    }, {
      feed: feedID2,
      text: 'hozz',
      embeds: []
    }]
    const subscribers = [{
      feed: feedID1,
      id: 's1',
      type: 'user'
    }, {
      feed: feedID1,
      id: 's2',
      type: 'role'
    }]
    const data = {
      profile,
      feeds,
      filteredFormats,
      subscribers
    }
    const guildData = new GuildData(JSON.parse(JSON.stringify(data)))
    await guildData.restore()
    const db = con.db
    const [
      foundProfile,
      foundFeed1,
      foundFeed2,
      foundFormat1,
      foundFormat2,
      foundSubscriber1,
      foundSubscriber2
    ] = await Promise.all([
      db.collection('profiles').findOne(profile),
      db.collection('feeds').findOne(feeds[0]),
      db.collection('feeds').findOne(feeds[1]),
      db.collection('filtered_formats').findOne(filteredFormats[0]),
      db.collection('filtered_formats').findOne(filteredFormats[1]),
      db.collection('subscribers').findOne(subscribers[0]),
      db.collection('subscribers').findOne(subscribers[1])
    ])
    expect(foundProfile).toEqual(expect.objectContaining(profile))
    expect(foundFeed1).toEqual(expect.objectContaining(feeds[0]))
    expect(foundFeed2).toEqual(expect.objectContaining(feeds[1]))
    expect(foundFormat1).toEqual(expect.objectContaining(filteredFormats[0]))
    expect(foundFormat2).toEqual(expect.objectContaining(filteredFormats[1]))
    expect(foundSubscriber1).toEqual(expect.objectContaining(subscribers[0]))
    expect(foundSubscriber2).toEqual(expect.objectContaining(subscribers[1]))
    await con.db.dropDatabase()
  })
  it('gets', async function () {
    const feedID1 = new mongoose.Types.ObjectId()
    const feedID2 = new mongoose.Types.ObjectId()
    const profile = {
      _id: 'getguildid',
      name: 'whaa'
    }
    const feeds = [{
      _id: feedID1,
      title: 'ha',
      url: 'url',
      guild: 'getguildid',
      channel: 'abc',
      embeds: []
    }, {
      _id: feedID2,
      title: 'ha2',
      url: 'url2',
      guild: 'getguildid',
      channel: 'abc2',
      embeds: []
    }]
    const filteredFormats = [{
      feed: feedID1,
      text: 'abc',
      embeds: []
    }, {
      feed: feedID2,
      text: 'hozz',
      embeds: []
    }]
    const subscribers = [{
      feed: feedID1,
      id: 's1',
      type: 'user'
    }, {
      feed: feedID1,
      id: 's2',
      type: 'role'
    }]
    const data = JSON.parse(JSON.stringify({
      profile,
      feeds,
      filteredFormats,
      subscribers
    }))
    const db = con.db
    await Promise.all([
      db.collection('profiles').insertOne(profile),
      db.collection('feeds').insertMany(feeds),
      db.collection('filtered_formats').insertMany(filteredFormats),
      db.collection('subscribers').insertMany(subscribers)
    ])
    const guildData = await GuildData.get(profile._id)
    expect(guildData.profile).toEqual(expect.objectContaining(data.profile))
    expect(guildData.feeds[0]).toEqual(expect.objectContaining(data.feeds[0]))
    expect(guildData.feeds[1]).toEqual(expect.objectContaining(data.feeds[1]))
    expect(guildData.filteredFormats[0]).toEqual(expect.objectContaining(data.filteredFormats[0]))
    expect(guildData.filteredFormats[1]).toEqual(expect.objectContaining(data.filteredFormats[1]))
    expect(guildData.subscribers[0]).toEqual(expect.objectContaining(data.subscribers[0]))
    expect(guildData.subscribers[1]).toEqual(expect.objectContaining(data.subscribers[1]))
    con.db.dropDatabase()
  })
  it('restores without profile correctly', async function () {
    const feedID1 = new mongoose.Types.ObjectId()
    const feeds = [{
      _id: feedID1,
      title: 'ha',
      url: 'url',
      guild: '123',
      channel: 'abc',
      embeds: []
    }]
    const data = {
      feeds,
      filteredFormats: [],
      subscribers: []
    }
    const guildData = new GuildData(JSON.parse(JSON.stringify(data)))
    await guildData.restore()
    const db = con.db
    const foundFeed1 = await db.collection('feeds').findOne(feeds[0])
    expect(foundFeed1).toEqual(expect.objectContaining(feeds[0]))
    await con.db.dropDatabase()
  })
  it('restores with conflicting _ids in database', async function () {
    const feedID = new mongoose.Types.ObjectId()
    const profile = {
      _id: 'conflictingids',
      name: 'conflicter'
    }
    const feeds = [{
      _id: feedID,
      title: 'ha',
      url: 'url',
      guild: profile._id,
      channel: 'abc',
      embeds: []
    }]
    const data = {
      profile,
      feeds,
      filteredFormats: [],
      subscribers: []
    }
    const db = con.db
    await Promise.all([
      db.collection('profiles').insertOne(profile),
      db.collection('feeds').insertMany(feeds)
    ])
    const guildData = new GuildData(JSON.parse(JSON.stringify(data)))
    await guildData.restore()
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
