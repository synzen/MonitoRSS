process.env.TEST_ENV = true
const config = require('../../../config.js')
const mongoose = require('mongoose')
const Supporter = require('../../../structs/db/Supporter.js')
const Patron = require('../../../structs/db/Patron.js')
const initialize = require('../../../initialization/index.js')
const dbName = 'test_int_supporters'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

jest.mock('../../../config.js')

describe('Int::structs/db/Supporter Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  /** @type {import('mongoose').Collection} */
  let collection
  beforeAll(async function () {
    con = await mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
    await initialize.setupModels(con)
    collection = con.db.collection('supporters')
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
    config.get.mockReturnValue({
      _vip: true,
      database: {
        uri: 'mongodb://'
      },
      feeds: {
        max: 5
      }
    })
  })
  describe('static getGuilds', function () {
    it('returns guilds of all valid supporters', async function () {
      const tenDaysAgo = new Date()
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
      const tenDaysFuture = new Date()
      tenDaysFuture.setDate(tenDaysFuture.getDate() + 10)
      // Invalid non-patron, expired
      const supporter1 = {
        _id: 'w4e3yr5h',
        expireAt: tenDaysAgo.toISOString(),
        patron: false
      }
      // Valid patron, active
      const supporter2 = {
        _id: 'supporter2discord',
        patron: true
      }
      const patron2 = {
        discord: supporter2._id,
        status: Patron.STATUS.ACTIVE,
        pledge: 1,
        pledgeLifetime: 1
      }
      // Invalid patron, former
      const supporter3 = {
        _id: 'supporter3discord',
        patron: true
      }
      const patron3 = {
        discord: supporter3._id,
        status: Patron.STATUS.FORMER,
        pledge: 1,
        pledgeLifetime: 1
      }
      // Valid non-patron, not expired
      const supporter4 = {
        _id: 'w34e5rtu',
        patron: false,
        expireAt: tenDaysFuture.toISOString()
      }
      await collection.insertMany([
        supporter1,
        supporter2,
        supporter3,
        supporter4
      ])
      await con.db.collection('patrons').insertMany([
        patron2,
        patron3
      ])
      const returned = await Supporter.getValidSupporters()
      expect(returned.length).toEqual(2)
      expect(returned[0]).toBeInstanceOf(Supporter)
      expect(returned[0].toObject()).toEqual(expect.objectContaining(supporter2))
      expect(returned[1]).toBeInstanceOf(Supporter)
      expect(returned[1].toObject()).toEqual(expect.objectContaining(supporter4))
    })
  })
  describe('getValidFastGuilds', function () {
    it('returns correctly', async () => {
      const slowDiscordId = 'weryhdt'
      const slowPatronData = {
        discord: slowDiscordId,
        status: Patron.STATUS.ACTIVE,
        pledge: Patron.SLOW_THRESHOLD - 1,
        pledgeLifetime: 0
      }
      const slowSupporterData = {
        _id: slowDiscordId,
        patron: true,
        slowRate: true,
        guilds: ['a', 'b']
      }
      const fastDiscordId = 'w4ery5e3uthjr'
      const fastPatronData = {
        discord: fastDiscordId,
        status: Patron.STATUS.ACTIVE,
        pledge: Patron.SLOW_THRESHOLD + 1,
        pledgeLifetime: 0
      }
      const fastDiscordId2 = 'weasdfg'
      const fastPatron2Data = {
        ...fastPatronData,
        discord: fastDiscordId2
      }
      const fastSupporterData = {
        _id: fastDiscordId,
        patron: true,
        guilds: ['c', 'd']
      }
      const fastSupporter2Data = {
        ...fastSupporterData,
        _id: fastDiscordId2,
        guilds: ['e', 'f']
      }
      await con.db.collection('patrons').insertMany([
        slowPatronData,
        fastPatronData,
        fastPatron2Data
      ])
      await con.db.collection(Supporter.Model.collection.collectionName)
        .insertMany([
          slowSupporterData,
          fastSupporterData,
          fastSupporter2Data
        ])
      const guildIds = await Supporter.getValidFastGuilds()
      expect(guildIds).toEqual(['c', 'd', 'e', 'f'])
    })
  })
  describe('getValidSupporterOfGuild', function () {
    it('returns supporters who did not expire yet', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        }
      })
      const past = new Date(new Date().getTime() - (1000 * 60))
      const future = new Date(new Date().getTime() + (1000 * 60 * 60 * 60 * 24))
      const guildID = 'guild1'
      const supporters = [{
        _id: 'a',
        guilds: [guildID],
        expireAt: past.toISOString()
      }, {
        _id: 'b',
        guilds: [guildID],
        expireAt: future.toISOString()
      }, {
        _id: 'c',
        guilds: [guildID]
      }, {
        _id: 'd',
        guilds: [guildID + '2'],
        expireAt: future.toISOString()
      }]
      await con.db.collection(Supporter.Model.collection.name).insertMany(supporters)
      const returned = await Supporter.getValidSupporterOfGuild('guild1')
      expect(returned).toEqual(expect.objectContaining(supporters[1]))
    })
    it('works with patrons', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        }
      })
      const guildID = 'qw234et6r'
      const patrons = [{
        discord: 'a',
        status: Patron.STATUS.DECLINED,
        lastCharge: undefined,
        pledgeLifetime: 1,
        pledge: 1
      }, {
        discord: 'b',
        status: Patron.STATUS.ACTIVE,
        pledgeLifetime: 1,
        pledge: 1
      }]
      const supporters = [{
        _id: patrons[0].discord,
        guilds: [guildID],
        patron: true
      }, {
        _id: 'nopatron',
        patron: true
      }, {
        _id: patrons[1].discord,
        guilds: [guildID],
        patron: true
      }]
      await con.db.collection(Patron.Model.collection.name).insertMany(patrons)
      await con.db.collection(Supporter.Model.collection.name).insertMany(supporters)
      const returned = await Supporter.getValidSupporterOfGuild(guildID)
      expect(returned).toEqual(expect.objectContaining(supporters[2]))
    })
  })
  describe('getValidSupporters', function () {
    it('returns all valid supporters', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        }
      })
      const past = new Date(new Date().getTime() - (1000 * 60))
      const future = new Date(new Date().getTime() + (1000 * 60 * 60 * 60 * 24))
      const supporters = [{
        _id: 'a',
        expireAt: past.toISOString()
      }, {
        _id: 'b',
        expireAt: future.toISOString()
      }, {
        _id: 'c'
      }, {
        _id: 'd',
        expireAt: future.toISOString()
      }]
      await con.db.collection(Supporter.Model.collection.name).insertMany(supporters)
      const returned = await Supporter.getValidSupporters()
      expect(returned).toHaveLength(3)
      expect(returned).toEqual([
        expect.objectContaining(supporters[1]),
        expect.objectContaining(supporters[2]),
        expect.objectContaining(supporters[3])
      ])
    })
    it('works with patrons', async function () {
      config.get.mockReturnValue({
        _vip: true,
        database: {
          uri: 'mongodb://'
        }
      })
      const patrons = [{
        discord: 'a',
        status: Patron.STATUS.DECLINED,
        lastCharge: undefined,
        pledgeLifetime: 1,
        pledge: 1
      }, {
        discord: 'b',
        status: Patron.STATUS.ACTIVE,
        pledgeLifetime: 1,
        pledge: 1
      }, {
        discord: 'c',
        status: Patron.STATUS.ACTIVE,
        pledgeLifetime: 1,
        pledge: 1
      }]
      const supporters = [{
        _id: patrons[0].discord,
        patron: true
      }, {
        _id: 'nopatron',
        patron: true
      }, {
        _id: patrons[1].discord,
        patron: true
      }, {
        _id: patrons[2].discord,
        patron: true
      }]
      await con.db.collection(Patron.Model.collection.name).insertMany(patrons)
      await con.db.collection(Supporter.Model.collection.name).insertMany(supporters)
      const returned = await Supporter.getValidSupporters()
      expect(returned).toEqual([
        expect.objectContaining(supporters[2]),
        expect.objectContaining(supporters[3])
      ])
    })
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
        await con.db.collection('patrons').insertOne(patronData)
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
        await con.db.collection('patrons').insertOne(patronData)
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
      await con.db.collection('patrons').insertOne(patronData)
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
      await con.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getMaxFeeds()).resolves.toEqual(config.get().feeds.max)
    })
  })
  describe('getMaxGuilds', function () {
    it('returns max guilds correctly for patron via method', async function () {
      const discordId = 'getmaxfeeds max guilds patron'
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
      await con.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getMaxGuilds()).resolves.toEqual(3)
    })
    it('returns 1 for inactive patron via method', async function () {
      const discordId = 'getmaxfeeds max guilds former patron'
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
      await con.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getMaxGuilds()).resolves.toEqual(1)
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
      await con.db.collection('patrons').insertOne(patronData)
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
      await con.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.getWebhookAccess()).resolves.toEqual(true)
    })
  })
  describe('hasSlowRate', () => {
    it('returns true correctly for patron', async () => {
      const discordId = 'hasslowrate patron'
      const data = {
        _id: discordId,
        patron: true
      }
      await collection.insertOne(data)
      const patronData = {
        discord: discordId,
        status: Patron.STATUS.ACTIVE,
        pledge: Patron.SLOW_THRESHOLD + 1,
        pledgeLifetime: 0
      }
      await con.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.hasSlowRate())
        .resolves.toEqual(false)
    })
    it('returns false correctly for patron', async () => {
      const discordId = 'hasslowrate patron'
      const data = {
        _id: discordId,
        patron: true
      }
      await collection.insertOne(data)
      const patronData = {
        discord: discordId,
        status: Patron.STATUS.ACTIVE,
        pledge: Patron.SLOW_THRESHOLD - 1,
        pledgeLifetime: 0
      }
      await con.db.collection('patrons').insertOne(patronData)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.hasSlowRate())
        .resolves.toEqual(true)
    })
    it('returns true correctly for patron not found', async () => {
      const discordId = 'hasslowrate patron'
      const data = {
        _id: discordId,
        patron: true,
        slowRate: true
      }
      await collection.insertOne(data)
      const supporter = await Supporter.get(data._id)
      await expect(supporter.hasSlowRate())
        .resolves.toEqual(true)
    })
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
