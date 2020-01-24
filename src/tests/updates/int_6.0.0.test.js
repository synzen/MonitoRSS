process.env.TEST_ENV = true
const mongoose = require('mongoose')
const dbName = 'test_int_v6'
const { updateProfiles, updateFailCounters } = require('../../../scripts/updates/6.0.0.js')
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

describe('Int::scripts/updates/6.0.0 Database', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost/${dbName}`, CON_OPTIONS)
  })
  beforeEach(async function () {
    await mongoose.connection.db.dropDatabase()
  })
  describe('fail_counters', function () {
    it('restores', async function () {
      const failedLink = {
        link: 'https://www.google.com',
        count: 20,
        failed: 'huzz'
      }
      await updateFailCounters(failedLink)
      const counter = await mongoose.connection.collection('fail_counters').findOne({
        link: failedLink.link
      })
      const expected = {
        ...failedLink,
        url: failedLink.link,
        reason: failedLink.failed
      }
      delete expected.link
      delete expected.failed
      expect(counter).toEqual(expect.objectContaining(failedLink))
    })
  })
  describe('profile', function () {
    it(`does restores profile`, async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        prefix: '22'
      }
      await updateProfiles(guildRss)
      const profile = await mongoose.connection.collection('profiles').findOne({
        _id: guildRss.id
      })
      expect(profile).toBeDefined()
    })
    it(`does restores profile with alerts`, async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sendAlertsTo: ['22']
      }
      await updateProfiles(guildRss)
      const profile = await mongoose.connection.collection('profiles').findOne({
        _id: guildRss.id
      })
      expect(profile).toBeDefined()
    })
    it('does not restore empty profile', async function () {
      const guildRss = {
        id: '32qwethk4ry',
        name: 'azdsh',
        sendAlertsTo: []
      }
      await updateProfiles(guildRss)
      const profile = await mongoose.connection.collection('profiles').findOne({
        _id: guildRss.id
      })
      expect(profile).toBeNull()
    })
  })
  describe('feeds', function () {
    it('saves correctly', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sources: {
          f1: {
            title: 't1',
            link: 'u1',
            channel: 'q3wet4'
          },
          f2: {
            title: 't2',
            link: 'u2',
            channel: 'aq3wet4'
          }
        }
      }
      await updateProfiles(guildRss)
      const feeds = await mongoose.connection.collection('feeds').find({
        guild: guildRss.id
      }).toArray()
      expect(feeds).toHaveLength(2)
    })
    it('saves correctly with message', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sources: {
          f1: {
            title: 't1',
            link: 'u1',
            channel: 'q3wet4',
            message: 'awr'
          },
          f2: {
            title: 't2',
            link: 'u2',
            channel: 'aq3wet4',
            message: 'sergt'
          }
        }
      }
      await updateProfiles(guildRss)
      const feeds = await mongoose.connection.collection('feeds').find({
        guild: guildRss.id
      }).toArray()
      expect(feeds).toContainEqual(expect.objectContaining({
        text: guildRss.sources.f1.message
      }))
      expect(feeds).toContainEqual(expect.objectContaining({
        text: guildRss.sources.f2.message
      }))
    })
    it('saves correctly with embeds', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sources: {
          f1: {
            title: 't1',
            link: 'u1',
            channel: 'q3wet4',
            embeds: [{
              title: 'h'
            }]
          },
          f2: {
            title: 't2',
            link: 'u2',
            channel: 'aq3wet4',
            embeds: [{
              title: 'aegds'
            }]
          }
        }
      }
      await updateProfiles(guildRss)
      const feeds = await mongoose.connection.collection('feeds').find({
        guild: guildRss.id
      }).toArray()
      expect(feeds).toContainEqual(expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining(guildRss.sources.f1.embeds[0])
        ])
      }))
      expect(feeds).toContainEqual(expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining(guildRss.sources.f1.embeds[0])
        ])
      }))
    })
  })
  describe('subscribers', function () {
    it('saves correctly', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sources: {
          f1: {
            title: 't1',
            link: 'u1',
            channel: 'q3wet4',
            subscribers: [{
              id: 'are',
              type: 'role'
            }, {
              id: 'ees',
              type: 'user'
            }]
          },
          f2: {
            title: 't2',
            link: 'u2',
            channel: 'aq3wet4',
            subscribers: [{
              id: 'are',
              type: 'role'
            }]
          }
        }
      }
      await updateProfiles(guildRss)
      const subscribers = await mongoose.connection
        .collection('subscribers').find({}).toArray()
      expect(subscribers).toHaveLength(3)
    })
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
