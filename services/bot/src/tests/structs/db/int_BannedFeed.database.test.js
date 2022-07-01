process.env.TEST_ENV = true
const mongoose = require('mongoose')
const initialize = require('../../../initialization/index.js')
const BannedFeed = require('../../../structs/db/BannedFeed.js')
const dbName = 'test_int_bannedfeeds'
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

describe('Int::structs/db/BannedFeed Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await con.db.dropDatabase()
    await initialize.setupModels(con)
    collection = con.db.collection('banned_feeds')
    await collection.createIndex({
      urlPattern: 'text'
    })
  })

  describe('findForUrl', () => {
    it('does not return a record for a url that matches but for a guild that does not apply', async () => {
      const url = 'https://www.reddit.com/r/'
      await collection.insertOne({
        url: url,
        guildIds: ['123']
      })
      const record = await BannedFeed.findForUrl(url, '456')
      expect(record).toBeNull()
    })

    it('does not return a record if the url does not match', async () => {
      const url = 'a'
      const guildId = 'guild-id'
      await collection.insertOne({
        url: 'b',
        guildIds: []
      })
      const record = await BannedFeed.findForUrl(url, guildId)
      expect(record).toBeNull()
    })

    it('returns the record for exact matches', async () => {
      const url = 'https://www.reddit.com/r/'
      const guildId = 'guild-id'
      await collection.insertOne({
        url: url,
        guildIds: [guildId]
      })
      const record = await BannedFeed.findForUrl(url, guildId)
      console.log(await collection.find().toArray())
      expect(record).not.toBeNull()
    })
  })

  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
