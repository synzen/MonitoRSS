process.env.TEST_ENV = true
const config = require('../../../config.js')
const mongoose = require('mongoose')
const FailRecord = require('../../../structs/db/FailRecord.js')
const initialize = require('../../../initialization/index.js')
const dbName = 'test_int_failcounter'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js', () => ({
  get: () => ({
    database: {
      uri: 'mongodb://'
    },
    feeds: {
      hoursUntilFail: 24
    }
  })
}))

function getOldDate (hoursAgo) {
  // https://stackoverflow.com/questions/1050720/adding-hours-to-javascript-date-object
  const date = new Date()
  date.setTime(date.getTime() - hoursAgo * 60 * 60 * 1000)
  return date
}

const oldDate = getOldDate(config.get().feeds.hoursUntilFail + 2)
const recentDate = getOldDate(config.get().feeds.hoursUntilFail - 1)

describe('Int::structs/db/FailRecord Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await con.db.dropDatabase()
    await initialize.setupModels(con)
    collection = con.db.collection('fail_records')
  })
  describe('static record', function () {
    it('creates the doc if url is new', async function () {
      const url = 'wst34eygr5ht'
      const reason = '23twe4gr'
      const record = await FailRecord.record(url, reason)
      const date = record.failedAt
      const result = await collection.findOne({
        _id: url
      })
      expect(result).toBeDefined()
      expect(result.failedAt.toISOString()).toEqual(date)
      expect(result.reason).toEqual(reason)
      await collection.deleteOne({ url })
    })
    it('updates reason and alerted field if it exists for old date', async function () {
      const url = 'incdocexist'
      const reason = 'q23werf'
      await collection.insertOne({
        _id: url,
        failedAt: oldDate
      })
      await FailRecord.record(url, reason)
      const result = await collection.findOne({
        _id: url
      })
      expect(result.reason).toEqual(reason)
      await collection.deleteOne({ url })
    })
    it('does not change alerted status if not old date', async function () {
      const url = 'incdocexistrecent'
      await collection.insertOne({
        _id: url,
        failedAt: recentDate,
        alerted: false
      })
      await FailRecord.record(url)
      const result = await collection.findOne({
        _id: url
      })
      expect(result.alerted).toEqual(false)
      await collection.deleteOne({ url })
    })
  })
  describe('static reset', function () {
    it('deletes the url if it exists', async function () {
      const url = 'incdocreset'
      collection.insertOne({
        _id: url
      })
      expect(collection.findOne({ _id: url }))
        .resolves.toBeDefined()
      await FailRecord.reset(url)
      expect(collection.findOne({ _id: url }))
        .resolves.toBeNull()
    })
  })
  describe('static hasFailed', function () {
    it('returns true for failed urls', async function () {
      const url = 'hasfailed'
      await collection.insertOne({
        _id: url,
        failedAt: oldDate
      })
      await expect(FailRecord.hasFailed(url))
        .resolves.toEqual(true)
    })
    it('returns false for not failed urls', async function () {
      const url = 'hasnotfailed'
      await collection.insertOne({
        _id: url,
        count: recentDate
      })
      await expect(FailRecord.hasFailed(url))
        .resolves.toEqual(false)
    })
    it('returns false for nonexistent urls', async function () {
      await expect(FailRecord.hasFailed('asd'))
        .resolves.toEqual(false)
    })
  })

  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
