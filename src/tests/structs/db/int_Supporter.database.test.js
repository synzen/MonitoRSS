process.env.TEST_ENV = true
const config = require('../../../config.js')
const mongoose = require('mongoose')
const Supporter = require('../../../structs/db/Supporter.js')
const Patron = require('../../../structs/db/Patron.js')
const dbName = 'test_int_patrons'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js')

describe('Int::structs/db/Supporter Database', function () {
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    config.database.uri = 'mongodb://'
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await mongoose.connection.db.dropDatabase()
    collection = mongoose.connection.db.collection('supporters')
  })
  describe('isValid', function () {
    describe('no patron', function () {
      it('returns true if no expireAt', async function () {
        const data = {
          _id: 'isvalidnopatron'
        }
        await collection.insertOne(data)
        const supporter = await Supporter.get(data._id)
        await expect(supporter.isValid()).resolves.toEqual(true)
      })
      it('returns true if now is past expire date', async function () {
        const expireAt = new Date()
        expireAt.setDate(expireAt.getDate() - 1)
        const data = {
          _id: 'isvalidnopatronpastexpire',
          expireAt
        }
        await collection.insertOne(data)
        const supporter = await Supporter.get(data._id)
        await expect(supporter.isValid()).resolves.toEqual(false)
      })
    })
    describe('is patron', function () {
      it('returns false for no patron in database', async function () {
        const data = {
          _id: 'isvalidpatronnoexist',
          patron: true
        }
        await collection.insertOne(data)
        const supporter = await Supporter.get(data._id)
        await expect(supporter.isValid()).resolves.toEqual(false)
      })
      it('returns the active status of the patron if they exist', async function () {
        const discordId = 'great id'
        const data = {
          _id: discordId,
          patron: true
        }
        await collection.insertOne(data)
        const patronData = {
          discord: discordId,
          status: Patron.STATUS.ACTIVE,
          pledgeLifetime: 11,
          pledge: 45
        }
        await mongoose.connection.db.collection('patrons').insertOne(patronData)
        const supporter = await Supporter.get(data._id)
        await expect(supporter.isValid()).resolves.toEqual(true)
      })
      it('returns the former status of the patron if they exist', async function () {
        const discordId = 'former id'
        const data = {
          _id: discordId,
          patron: true
        }
        await collection.insertOne(data)
        const patronData = {
          discord: discordId,
          status: Patron.STATUS.FORMER,
          pledgeLifetime: 11,
          pledge: 45
        }
        await mongoose.connection.db.collection('patrons').insertOne(patronData)
        const supporter = await Supporter.get(data._id)
        await expect(supporter.isValid()).resolves.toEqual(false)
      })
    })
  })
  describe('getMaxFeeds', function () {
    it('returns max feeds correctly for patron via method', async function () {
      const discordId = 'getmaxfeeds max feeds patron'
      const data = {
        _id: discordId,
        patron: true
      }
      await collection.insertOne(data)
      const patronData = {
        discord: discordId,
        status: Patron.STATUS.ACTIVE,
        pledge: 1250,
        pledgeLifetime: 10000
      }
      await mongoose.connection.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getMaxFeeds()).resolves.toEqual(70)
    })
    it('returns default max feeds for former patron via method', async function () {
      const discordId = 'getmaxfeeds max feeds former patron'
      const data = {
        _id: discordId,
        patron: true
      }
      await collection.insertOne(data)
      const patronData = {
        discord: discordId,
        status: Patron.STATUS.FORMER,
        pledge: 1250,
        pledgeLifetime: 10000
      }
      await mongoose.connection.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getMaxFeeds()).resolves.toEqual(config.feeds.max)
    })
  })
  describe('getMaxServers', function () {
    it('returns max servers correctly for patron via method', async function () {
      const discordId = 'getmaxfeeds max servers patron'
      const data = {
        _id: discordId,
        patron: true
      }
      await collection.insertOne(data)
      const patronData = {
        discord: discordId,
        status: Patron.STATUS.ACTIVE,
        pledge: 1,
        pledgeLifetime: 1600
      }
      await mongoose.connection.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getMaxServers()).resolves.toEqual(3)
    })
    it('returns 1 for inactive patron via method', async function () {
      const discordId = 'getmaxfeeds max servers former patron'
      const data = {
        _id: discordId,
        patron: true
      }
      await collection.insertOne(data)
      const patronData = {
        discord: discordId,
        status: Patron.STATUS.FORMER,
        pledge: 1,
        pledgeLifetime: 1600
      }
      await mongoose.connection.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getMaxServers()).resolves.toEqual(1)
    })
  })
  describe('getWebhookAccess', function () {
    it('returns webhook access for unqualified patron via method', async function () {
      const discordId = 'getwebhookaccess unqualified patron'
      const data = {
        _id: discordId,
        patron: true
      }
      await collection.insertOne(data)
      const patronData = {
        discord: discordId,
        status: Patron.STATUS.ACTIVE,
        pledge: 1,
        pledgeLifetime: 1600
      }
      await mongoose.connection.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getWebhookAccess()).resolves.toEqual(false)
    })
    it('returns webhook access for qualified patron via method', async function () {
      const discordId = 'getwebhookaccess qualified patron'
      const data = {
        _id: discordId,
        patron: true
      }
      await collection.insertOne(data)
      const patronData = {
        discord: discordId,
        status: Patron.STATUS.ACTIVE,
        pledge: 1001,
        pledgeLifetime: 1600
      }
      await mongoose.connection.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getWebhookAccess()).resolves.toEqual(true)
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
