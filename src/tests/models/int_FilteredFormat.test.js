process.env.TEST_ENV = true
const mongoose = require('mongoose')
const FilteredFormat = require('../../models/FilteredFormat.js').model
require('../../models/Feed.js')
const dbName = 'test_int_filteredformat'
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
    collection = mongoose.connection.db.collection('filteredformats')
  })
  it('saves with filters', async function () {
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
    const filteredFormat = new FilteredFormat(data)
    await filteredFormat.save()
    const found = await collection.findOne({ feed: feedID })
    expect(found).toBeDefined()
    expect(found).toEqual(expect.objectContaining(data))
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
