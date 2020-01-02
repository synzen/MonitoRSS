process.env.TEST_ENV = true
const config = require('../../../config.js')
const mongoose = require('mongoose')
const FailCounter = require('../../../structs/db/FailCounter.js')
const dbName = 'test_int_failcounter'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js')

config.feeds.failLimit = 3

describe('Int::structs/db/FailCounter Database', function () {
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    config.database.uri = 'mongodb://'
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
    collection = mongoose.connection.db.collection('fail_counters')
  })
  describe('static increment', function () {
    it(`creates the doc if url is new`, async function () {
      const url = 'wst34eygr5ht'
      await FailCounter.increment(url)
      const result = await collection.findOne({
        url
      })
      expect(result).toBeDefined()
      expect(result.count).toEqual(0)
      expect(result.reason).toBeUndefined()
      await collection.deleteOne({ url })
    })
    it(`increments the doc if it exists`, async function () {
      const url = 'incdocexist'
      await collection.insertOne({
        url,
        count: 0
      })
      await FailCounter.increment(url)
      const result = await collection.findOne({
        url
      })
      expect(result.count).toEqual(1)
      await collection.deleteOne({ url })
    })
  })
  describe('static reset', function () {
    it('deletes the url if it exists', async function () {
      const url = 'incdocreset'
      collection.insertOne({
        url,
        count: 5
      })
      expect(collection.findOne({ url }))
        .resolves.toBeDefined()
      await FailCounter.reset(url)
      expect(collection.findOne({ url }))
        .resolves.toBeNull()
    })
  })
  describe('static hasFailed', function () {
    it('returns true for failed urls', async function () {
      const url = 'hasfailed'
      await collection.insertOne({
        url,
        count: config.feeds.failLimit
      })
      await expect(FailCounter.hasFailed(url))
        .resolves.toEqual(true)
    })
    it('returns false for not failed urls', async function () {
      const url = 'hasnotfailed'
      await collection.insertOne({
        url,
        count: config.feeds.failLimit - 1
      })
      await expect(FailCounter.hasFailed(url))
        .resolves.toEqual(false)
    })
    it('returns false for nonexistent urls', async function () {
      await expect(FailCounter.hasFailed('asd'))
        .resolves.toEqual(false)
    })
  })
  describe('increment', function () {
    it('adds 1 to database for new url', async function () {
      const url = 'instanceincrementnew'
      const counter = new FailCounter({
        url
      })
      await counter.increment()
      const found = await collection.findOne({ url })
      expect(found.count).toEqual(1)
    })
    it('adds 1 to database for old url', async function () {
      const url = 'instanceincrentold'
      const counter = new FailCounter({
        url
      })
      await counter.increment()
      await counter.increment()
      const found = await collection.findOne({ url })
      expect(found.count).toEqual(2)
    })
    it('adds reason if past threshold', async function () {
      const url = 'instanceincrementreason'
      const reason = 'foozzz'
      await collection.insertOne({
        url,
        count: config.feeds.failLimit
      })
      const counter = await FailCounter.getBy('url', url)
      await counter.increment(reason)
      await expect(collection.findOne({ url }))
        .resolves.toHaveProperty('reason', reason)
    })
    it('updates the reason if past threshold', async function () {
      const url = 'instanceincrementreason'
      const reason = 'foozzz'
      const newReason = reason + 'hozz'
      await collection.insertOne({
        url,
        count: config.feeds.failLimit
      })
      const counter = await FailCounter.getBy('url', url)
      await counter.increment(reason)
      await counter.increment(newReason)
      await expect(collection.findOne({ url }))
        .resolves.toHaveProperty('reason', newReason)
    })
    it('does not increment past threshold', async function () {
      const url = 'instanceincrementnofail'
      const reason = 'foozzz'
      await collection.insertOne({
        url,
        count: config.feeds.failLimit
      })
      const counter = await FailCounter.getBy('url', url)
      await counter.increment(reason)
      await expect(collection.findOne({ url }))
        .resolves.toHaveProperty('count', config.feeds.failLimit)
    })
  })
  describe('fail', function () {
    it('saves the reason', async function () {
      const url = 'instancefail'
      const reason = 'foozzz'
      const newReason = '34ygh5rebt'
      await collection.insertOne({
        url,
        count: config.feeds.failLimit,
        reason
      })
      const counter = await FailCounter.getBy('url', url)
      await counter.fail(newReason)
      await expect(collection.findOne({ url }))
        .resolves.toHaveProperty('reason', newReason)
    })
    it('saves the failedAt date', async function () {
      const url = 'instancefaildate'
      await collection.insertOne({
        url,
        count: 0
      })
      const counter = await FailCounter.getBy('url', url)
      await counter.fail('mz')
      await expect(collection.findOne({ url }))
        .resolves.toHaveProperty('failedAt')
    })
    it('sets the count to the fail limit', async function () {
      const url = 'instancefailsetlimit'
      await collection.insertOne({
        url,
        count: 0
      })
      const counter = await FailCounter.getBy('url', url)
      await counter.fail('mz')
      await expect(collection.findOne({ url }))
        .resolves.toHaveProperty('count', config.feeds.failLimit)
    })
  })

  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
