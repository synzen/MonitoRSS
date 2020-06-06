const FilteredFormatModel = require('../../../models/FilteredFormat.js')
const initialize = require('../../../initialization/index.js')
const mongoose = require('mongoose')

const dbName = 'test_int_middleware_format'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

describe('Int::models/middleware/FilteredFormat', function () {
  let con
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await con.db.dropDatabase()
    await initialize.setupModels(con)
  })
  it('throws an error if the feed does not exist', async function () {
    const format = new FilteredFormatModel.Model({
      text: 'ase',
      feed: new mongoose.Types.ObjectId().toHexString()
    })

    await expect(format.save())
      .rejects.toThrowError(/specified feed/)
  })
  it('throws an error if format tries to change feed', async function () {
    const filteredFormatID = new mongoose.Types.ObjectId()
    const feedId = new mongoose.Types.ObjectId()
    const newFeedId = new mongoose.Types.ObjectId()
    await Promise.all([
      con.db.collection('filtered_formats').insertOne({
        _id: filteredFormatID,
        text: 'abc',
        feed: feedId
      }),
      con.db.collection('feeds').insertOne({
        _id: feedId
      }),
      con.db.collection('feeds').insertOne({
        _id: newFeedId
      })
    ])

    const doc = await FilteredFormatModel.Model.findOne({ _id: filteredFormatID })
    const format = new FilteredFormatModel.Model(doc, true)
    format.feed = newFeedId.toHexString()
    await expect(format.save())
      .rejects.toThrow('Feed cannot be changed')
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
