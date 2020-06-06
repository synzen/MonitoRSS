process.env.TEST_ENV = true
const mongoose = require('mongoose')
const Patron = require('../../../structs/db/Patron.js')
const initialize = require('../../../initialization/index.js')
const dbName = 'test_int_patrons'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js', () => ({
  get: () => ({
    database: {
      uri: 'mongodb://'
    }
  })
}))

describe('Int::structs/db/Patron Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
    collection = con.db.collection('patrons')
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
  })
  describe('isActive', function () {
    it('returns true for active', async function () {
      const data = {
        _id: 'isactivetrue',
        status: Patron.STATUS.ACTIVE,
        pledge: 1,
        pledgeLifetime: 2
      }
      await collection.insertOne(data)
      const patron = await Patron.get(data._id)
      expect(patron.isActive()).toEqual(true)
    })
    it('returns false for former', async function () {
      const data = {
        _id: 'isactivefalse',
        status: Patron.STATUS.FORMER,
        pledge: 1,
        pledgeLifetime: 2
      }
      await collection.insertOne(data)
      const patron = await Patron.get(data._id)
      expect(patron.isActive()).toEqual(false)
    })
    it('returns false for unknown status', async function () {
      const data = {
        _id: 'isactivenull',
        status: null,
        pledge: 1,
        pledgeLifetime: 2
      }
      const data2 = {
        _id: 'isactiveunknown',
        status: 'abc',
        pledge: 1,
        pledgeLifetime: 2
      }
      await collection.insertMany([data, data2])
      const patron = await Patron.get(data._id)
      const patron2 = await Patron.get(data2._id)
      expect(patron.isActive()).toEqual(false)
      expect(patron2.isActive()).toEqual(false)
    })
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
