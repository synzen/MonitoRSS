process.env.TEST_ENV = true
const mongoose = require('mongoose')
const KeyValue = require('../../../structs/db/KeyValue.js')
const initialize = require('../../../initialization/index.js')
const dbName = 'test_int_keyvalue'
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

describe('Int::structs/db/KeyValue Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  /** @type {import('mongoose').Collection} */
  let collection
  let collectionName
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
    collectionName = KeyValue.Model.collection.collectionName
    collection = con.db.collection(collectionName)
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
  })
  it('saves correctly', async function () {
    const data = {
      _id: '12436',
      value: 'ahhh'
    }
    const kv = new KeyValue(data)
    await kv.save()
    const doc = await collection.findOne({ _id: data._id })
    expect(doc).toBeDefined()
    for (const key in data) {
      expect(doc[key]).toEqual(data[key])
    }
  })
  it('does not allow keys to be written over', async function () {
    const data = {
      _id: '12436',
      value: 'ahhh'
    }
    const kv = new KeyValue(data)
    await kv.save()
    const data2 = {
      _id: data._id,
      value: 'ahh2'
    }
    const kv2 = new KeyValue(data2)
    await expect(kv2.save()).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('duplicate key')
    }))
  })
  it('gets correctly', async function () {
    const data = {
      _id: 'foozxczdg',
      value: 'srfdetuj6y'
    }
    await collection.insertOne(data)
    const kv = await KeyValue.get(data._id)
    expect(kv).toBeDefined()
    for (const key in data) {
      expect(kv[key]).toEqual(data[key])
    }
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
