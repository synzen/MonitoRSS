process.env.TEST_ENV = true
const config = require('../../../config.js')
const Article = require('../../../models/Article.js')
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
    // Set up the database
    const assignedSchedules = [{
      feed: new mongoose.Types.ObjectId(),
      guild: '124',
      url: 'https://www.google.com/rss',
      shard: 1,
      schedule: 'default'
    }, {
      feed: new mongoose.Types.ObjectId(),
      url: 'https://www.google.com/rss',
      guild: '124',
      shard: 2,
      schedule: 'default'
    }, {
      feed: new mongoose.Types.ObjectId(),
      url: 'https://www.google2.com/rss',
      guild: '124',
      shard: 2,
      schedule: 'goggles'
    }]
    const db = mongoose.connection.db
    const usedCollectionIDs = []
    const unusedCollectionIDs = ['53unused1', '591unused2']
    const ignoreCollectionIDs = ['onlywords', 'donotcount']
    const collectionCreations = [
      db.collection('assigned_schedules')
        .insertMany(assignedSchedules)
    ]
    for (const a of assignedSchedules) {
      const collectionID = Article.getCollectionID(a.url, a.shard, a.schedule)
      usedCollectionIDs.push(collectionID)
      collectionCreations.push(db.collection(collectionID).insertOne({
        title: 'whatever'
      }))
    }
    for (const n of [ ...unusedCollectionIDs, ...ignoreCollectionIDs ]) {
      collectionCreations.push(db.collection(n).insertOne({
        title: 'whatever'
      }))
    }
    await Promise.all(collectionCreations)

    // Now assert
    const allCollections = await db.listCollections().toArray()
    const combinedCollectionIDs = [
      ...unusedCollectionIDs,
      ...usedCollectionIDs,
      ...ignoreCollectionIDs
    ]
    expect(allCollections.map(c => c.name))
      .toEqual(expect.arrayContaining(combinedCollectionIDs))
    await pruneCollections()
    const remainingCollections = await db.listCollections().toArray()
    expect(remainingCollections.map(c => c.name))
      .toEqual(expect.arrayContaining(usedCollectionIDs))
    expect(remainingCollections.map(c => c.name))
      .toEqual(expect.arrayContaining(ignoreCollectionIDs))
    expect(remainingCollections.map(c => c.name))
      .not.toEqual(expect.arrayContaining(unusedCollectionIDs))
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
