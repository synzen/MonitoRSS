process.env.TEST_ENV = true
const config = require('../../../config.js')
const mongoose = require('mongoose')
const Blacklist = require('../../../structs/db/Blacklist.js')
const dbName = 'test_int_blacklists'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js')

config.feeds.failLimit = 3

describe('Int::structs/db/Blacklist Database', function () {
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    config.database.uri = 'mongodb://'
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
    collection = mongoose.connection.db.collection('blacklists')
  })
  it('saves correctly', async function () {
    const data = {
      _id: '12436',
      type: Blacklist.TYPES.USER,
      name: 'ahhh'
    }
    const blacklist = new Blacklist(data)
    await blacklist.save()
    const doc = await collection.findOne({ _id: data._id })
    expect(doc).toBeDefined()
    for (const key in data) {
      expect(doc[key]).toEqual(data[key])
    }
  })
  it('gets correctly', async function () {
    const data = {
      _id: 'foozxczdg',
      type: Blacklist.TYPES.GUILD,
      name: 'srfdetuj6y'
    }
    await collection.insertOne(data)
    const blacklist = await Blacklist.get(data._id)
    expect(blacklist).toBeDefined()
    for (const key in data) {
      expect(blacklist[key]).toEqual(data[key])
    }
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
