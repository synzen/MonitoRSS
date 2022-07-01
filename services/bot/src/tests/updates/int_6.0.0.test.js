process.env.TEST_ENV = true
const config = require('../../config.js')
const mongoose = require('mongoose')
const initialize = require('../../initialization/index.js')
const { updateProfiles, updateFailRecords } = require('../../../scripts/updates/6.0.0.js')
const dbName = 'test_int_v6_migrate'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  /**
   * This is needed to prevent the tests from running while
   * the database has not finished building indexes. Only happens
   * in this test suite for some reason.
   */
  autoIndex: false
}

jest.mock('../../config.js', () => ({
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

describe('Int::scripts/updates/6.0.0 Database', function () {
  /** @type {import('mongoose').Connection} */
  let con
  const uri = `mongodb://localhost/${dbName}`
  beforeAll(async function () {
    process.env.DRSS_DATABASE_URI = uri
    con = await mongoose.createConnection(uri, CON_OPTIONS)
    await initialize.setupModels(con)
  })
  beforeEach(async function () {
    await con.db.dropDatabase()
  })
  describe('fail_records', function () {
    it('restores', async function () {
      const failedLink = {
        link: 'https://www.google1.com',
        count: 20,
        failed: 'huzz'
      }
      await updateFailRecords(failedLink)
      const record = await con.collection('fail_records').findOne({
        _id: failedLink.link
      })
      const expected = {
        _id: failedLink.link,
        reason: failedLink.failed,
        alerted: true
      }
      expect(record).toEqual(expect.objectContaining(expected))
      expect(record.failedAt).toBeInstanceOf(Date)
    })
    it('sets a date before the cutoff for failed links', async function () {
      const failedLink = {
        link: 'https://www.google2.com',
        count: 20,
        failed: 'huzz'
      }
      await updateFailRecords(failedLink)
      const record = await con.collection('fail_records').findOne({
        _id: failedLink.link
      })
      const cutoff = getOldDate(config.get().feeds.hoursUntilFail)
      expect(record.failedAt < cutoff)
    })
    it('sets a new date for not-yet-failed links', async function () {
      const failedLink = {
        link: 'https://www.google3.com',
        count: 20
      }
      await updateFailRecords(failedLink)
      const record = await con.collection('fail_records').findOne({
        _id: failedLink.link
      })
      const cutoff = getOldDate(config.get().feeds.hoursUntilFail)
      expect(record.failedAt > cutoff)
    })
  })
  describe('profile', function () {
    it('does restores profile', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        prefix: '22'
      }
      await updateProfiles(guildRss)
      const profile = await con.collection('profiles').findOne({
        _id: guildRss.id
      })
      expect(profile).toBeDefined()
    })
    it('does restores profile with alerts', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sendAlertsTo: ['22']
      }
      await updateProfiles(guildRss)
      const profile = await con.collection('profiles').findOne({
        _id: guildRss.id
      })
      expect(profile).toBeDefined()
    })
    it('deletes prefixes with empty spaces', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        prefix: 'hello world'
      }
      await updateProfiles(guildRss)
      const profile = await con.collection('profiles').findOne({
        _id: guildRss.id
      })
      expect(profile).toBeNull()
    })
    it('does not restore empty profile', async function () {
      const guildRss = {
        id: '32qwethk4ry',
        name: 'azdsh',
        sendAlertsTo: []
      }
      await updateProfiles(guildRss)
      const profile = await con.collection('profiles').findOne({
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
      const feeds = await con.collection('feeds').find({
        guild: guildRss.id
      }).toArray()
      expect(feeds).toHaveLength(2)
    })
    it('replaces old embed keys with new ones', async function () {
      const embeds = [{
        thumbnail_url: '1',
        authorUrl: '2',
        footer_text: '3',
        imageUrl: '4',
        author_name: '5',
        authorIconURL: '6',
        authorIconUrl: '7',
        fields: [{
          title: 'hello',
          value: 'world'
        }, {
          title: '',
          value: ''
        }]
      }]
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sources: {
          f1: {
            title: 't1',
            link: 'u1',
            channel: 'q3wet4',
            embeds
          }
        }
      }
      const expectedEmbeds = [{
        thumbnailURL: '1',
        authorURL: '2',
        footerText: '3',
        imageURL: '4',
        authorName: '5',
        authorIconURL: '6',
        fields: [{
          name: 'hello',
          value: 'world'
        }, {
          name: '\u200b',
          value: '\u200b'
        }]
      }]
      await updateProfiles(guildRss)
      const feed = await con.collection('feeds').findOne({
        guild: guildRss.id
      })
      expect(feed.embeds).toEqual(expectedEmbeds)
    })
    it('converts checkTitles to ncomparison', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sources: {
          f1: {
            title: 't1',
            link: 'u1',
            channel: 'q3wet4',
            checkTitles: true
          }
        }
      }
      await updateProfiles(guildRss)
      const feeds = await con.collection('feeds').find({
        guild: guildRss.id
      }).toArray()
      expect(feeds).toHaveLength(1)
      expect(feeds[0].ncomparisons).toEqual(['title'])
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
      const feeds = await con.collection('feeds').find({
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
      const feeds = await con.collection('feeds').find({
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
              id: 'are1',
              type: 'role'
            }, {
              id: 'ees2',
              type: 'user'
            }]
          },
          f2: {
            title: 't2',
            link: 'u2',
            channel: 'aq3wet4',
            subscribers: [{
              id: 'are3',
              type: 'role'
            }]
          }
        }
      }
      await updateProfiles(guildRss)
      const subscribers = await con
        .collection('subscribers').find({}).toArray()
      expect(subscribers).toHaveLength(3)
    })
    it('converts unknown subscriber types to role', async function () {
      const guildRss = {
        id: '32qwet4ry',
        name: 'azdsh',
        sources: {
          f2: {
            title: 't2',
            link: 'u2',
            channel: 'aq3wet4',
            subscribers: [{
              id: 'are3'
              // Missing type should be "role"
            }, {
              id: 'are4',
              type: 'boogaloo'
            }]
          }
        }
      }
      await updateProfiles(guildRss)
      const subscribers = await con
        .collection('subscribers').find({}).toArray()
      expect(subscribers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'are3',
          type: 'role'
        }),
        expect.objectContaining({
          id: 'are4',
          type: 'role'
        })
      ]))
    })
  })
  afterAll(async function () {
    await con.db.dropDatabase()
    await con.close()
  })
})
