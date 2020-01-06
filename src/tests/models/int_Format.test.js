process.env.TEST_ENV = true
const mongoose = require('mongoose')
const Format = require('../../models/Format.js').model
require('../../models/Feed.js')
require('../../models/FilteredFormat.js')
const dbName = 'test_int_format'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

describe('Int::models/FilteredFormat', function () {
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
    collection = mongoose.connection.db.collection('formats')
  })
  it('does not save with filters', async function () {
    const feedID = new mongoose.Types.ObjectId()
    await mongoose.connection.db.collection('feeds').insertOne({
      _id: feedID
    })
    const data = {
      feed: feedID,
      text: 'hello',
      filters: {
        title: ['hello', 'world']
      }
    }
    const format = new Format(data)
    await format.save()
    const found = await collection.findOne({ feed: feedID })
    expect(found).toBeDefined()
    expect(found.filters).toBeUndefined()
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
