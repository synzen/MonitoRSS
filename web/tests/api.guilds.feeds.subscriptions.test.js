/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const request = require('supertest')
const app = require('../index.js')
const models = require('../../util/storage.js').models
const nock = require('nock')
const discordAPIConstants = require('../constants/discordAPI.js')
const agent = request.agent(app())

describe('/guilds/:guildId/feeds/:feedId/subscriptions', function () {
  const userId = 'costanza'
  const guildId = 'guildtanks'
  const roles = [
    { id: 'role1', name: 'role1name' },
    { id: 'role2', name: 'role2name' },
    { id: 'role3', name: 'role3name' }]
  const discordAPIRoutes = [
    { route: `/guilds/${guildId}`, response: { owner_id: userId } },
    { route: `/guilds/${guildId}/roles`, response: roles },
    { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [] } }]
  beforeEach(function () {
    discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
  })
  beforeAll(async function (done) {
    agent
      .post('/session')
      .send({
        auth: { access_token: 'foobunk' },
        identity: { id: userId }
      })
      .expect(200, done)
  })

  describe('POST /', function () {
    it('adds global role subscription and returns the result when valid role', async function (done) {
      const chosenRole = roles[2]
      const expectedResult = { type: 'role', id: chosenRole.id, name: chosenRole.name }
      const feedId = 'HWATBOBBY'
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar'
        }
      } } }, { upsert: true })

      agent
        .post(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions`)
        .send({ type: 'role', id: chosenRole.id })
        .expect(201)
        .end(async function (err, res) {
          if (err) return done(err)
          expect(res.body).toEqual(expectedResult)
          expect(res.body.filters).toBe(expectedResult.filters)
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            if (!doc) return done(new Error('Document is missing'))
            const docArr = doc.sources[feedId].globalSubscriptions
            expect(docArr.constructor.name).toBe('Array')
            expect(docArr.length).toBe(1)
            expect(docArr[0]).toEqual(expectedResult)
            done()
          } catch (err) {
            done(err)
          }
        })
    })
    it('adds global user subscription and returns the result when valid user', async function (done) {
      const userId = 'louisId'
      const userName = 'louisName'
      const expectedResult = { type: 'user', id: userId, name: userName, filters: { title: 'hwat', description: 'dangit bobby' } }
      const feedId = 'HWATBOBBYAGAIN'
      nock(discordAPIConstants.apiHost)
        .get(`/users/${userId}`)
        .reply(200, { username: userName })
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar'
        }
      } } }, { upsert: true })

      agent
        .post(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions`)
        .send({ type: 'user', id: userId, filters: expectedResult.filters })
        .expect(201)
        .end(async function (err, res) {
          if (err) return done(err)
          expect(res.body).toEqual(expectedResult)
          expect(res.body.filters).toBe(res.body.filters)
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            if (!doc) return done(new Error('Document is missing'))
            const docArr = doc.sources[feedId].filteredSubscriptions
            expect(docArr.constructor.name).toBe('Array')
            expect(docArr.length).toBe(1)
            expect(docArr[0]).toEqual(expectedResult)
            expect(docArr[0].filters).toEqual(expectedResult.filters)
            done()
          } catch (err) {
            done(err)
          }
        })
    })

    it('returns with discord status and message for invalid user subscription', async function (done) {
      const userId = 'kaplooeyoooooo'
      const feedId = 'HWATBOBBYAGAINDANGIT'
      const discordMessage = { code: 400, message: 'A different discord message' }
      nock(discordAPIConstants.apiHost)
        .get(`/users/${userId}`)
        .reply(discordMessage.code, { message: discordMessage.message })
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar'
        }
      } } }, { upsert: true })

      agent
        .post(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions`)
        .send({ type: 'user', id: userId })
        .expect(discordMessage.code, { ...discordMessage, discord: true }, done)
    })

    it('returns a 403 code for invalid role subscription', async function (done) {
      const feedId = 'GETTIN ME RILED UP BOBBY'
      const chosenRole = roles[0]
      const expectedResponse = { code: 403, message: { id: 'Role is not in guild' } }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar'
        }
      } } }, { upsert: true })

      agent
        .post(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions`)
        .send({ type: 'role', id: chosenRole.id + 'garbage' })
        .expect(expectedResponse.code, expectedResponse, done)
    })

    it('returns a 400 code for missing id', async function (done) {
      const feedId = 'GETTIN ME RILED UP BOBBY AGAIN'
      const expectedResponse = { code: 400, message: { id: 'This field is required' } }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar'
        }
      } } }, { upsert: true })

      agent
        .post(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions`)
        .send({ type: 'role' })
        .expect(expectedResponse.code, expectedResponse, done)
    })

    it('returns a 400 code for missing/invalid type', async function (done) {
      const feedId = 'GETTIN ME RILED UP BOBBY AGAIN X2'
      const expectedResponse = { code: 400, message: { type: 'Must be "role" or "user"' } }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar'
        }
      } } }, { upsert: true })

      agent
        .post(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions`)
        .send({ id: 'asd' })
        .expect(expectedResponse.code, expectedResponse, done)
    })
  })

  describe('/PATCH /:subscriberId', function () {
    const subscriberId = '*gets down on my feet*'
    it('should move a global subscriber to filteredSubscriptions when sending a populated filters object', async function (done) {
      const feedId = 'someone send help'
      const globalSubscriber = { id: subscriberId, name: 'adesxdfgbkljs' }
      const otherGlobalSubscriber = { id: subscriberId + 1, name: globalSubscriber.name + 1 }
      const toSend = { id: subscriberId, filters: { title: 'aidesgbhdhnj' } }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar',
          globalSubscriptions: [ globalSubscriber, otherGlobalSubscriber ]
        }
      } } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions/${subscriberId}`)
        .send(toSend)
        .expect(200)
        .end(async function (err, res) {
          if (err) return done(err)
          const source = res.body.sources[feedId]
          expect(source.globalSubscriptions.length).toBe(1)
          expect(source.filteredSubscriptions.length).toBe(1)
          expect(source.filteredSubscriptions[0]).toEqual({ ...globalSubscriber, filters: toSend.filters })
          expect(source.globalSubscriptions[0]).toEqual(otherGlobalSubscriber)
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            const docSource = doc.sources[feedId]
            expect(docSource.globalSubscriptions.length).toBe(1)
            expect(docSource.filteredSubscriptions.length).toBe(1)
            expect(docSource.filteredSubscriptions[0]).toEqual({ ...globalSubscriber, filters: toSend.filters })
            expect(docSource.globalSubscriptions[0]).toEqual(otherGlobalSubscriber)
            done()
          } catch (err) {
            done(err)
          }
        })
    })

    it('should move a global subscriber to filteredSubscriptions when sending a populated filters object, and delete filteredSubscriptions if they are last', async function (done) {
      const feedId = 'someone send help'
      const globalSubscriber = { id: subscriberId, name: 'adesxdfgbkljs' }
      const toSend = { id: subscriberId, filters: { title: 'aidesgbhdhnj' } }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar',
          globalSubscriptions: [ globalSubscriber ]
        }
      } } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions/${subscriberId}`)
        .send(toSend)
        .expect(200)
        .end(async function (err, res) {
          if (err) return done(err)
          const source = res.body.sources[feedId]
          expect(source.globalSubscriptions).toBeUndefined()
          expect(source.filteredSubscriptions.length).toEqual(1)
          expect(source.filteredSubscriptions[0]).toEqual({ ...globalSubscriber, filters: toSend.filters })
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            const docSource = doc.sources[feedId]
            expect(docSource.globalSubscriptions).toBeUndefined()
            expect(docSource.filteredSubscriptions.length).toEqual(1)
            expect(docSource.filteredSubscriptions[0]).toEqual({ ...globalSubscriber, filters: toSend.filters })
            done()
          } catch (err) {
            done(err)
          }
        })
    })

    it('should move a filtered subscriber to globalSubscriptions when sending an empty filters object', async function (done) {
      const feedId = 'someone send help'
      const filteredSubscriber = { id: subscriberId, name: 'adesxdfgbkljs', filters: { title: 'WHOOSH' } }
      const otherFilteredSubscriber = { id: subscriberId + 1, name: filteredSubscriber.name + 1, filters: { title: 'WHOOSH2' } }
      const toSend = { id: subscriberId, filters: {} }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar',
          filteredSubscriptions: [ filteredSubscriber, otherFilteredSubscriber ]
        }
      } } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions/${subscriberId}`)
        .send(toSend)
        .expect(200)
        .end(async function (err, res) {
          if (err) return done(err)
          const source = res.body.sources[feedId]
          expect(source.filteredSubscriptions.length).toBe(1)
          expect(source.globalSubscriptions.length).toEqual(1)
          expect(source.globalSubscriptions[0]).toEqual({ id: subscriberId, name: filteredSubscriber.name })
          expect(source.filteredSubscriptions[0]).toEqual(otherFilteredSubscriber)
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            const docSource = doc.sources[feedId]
            expect(docSource.filteredSubscriptions.length).toBe(1)
            expect(docSource.globalSubscriptions.length).toEqual(1)
            expect(docSource.globalSubscriptions[0]).toEqual({ id: subscriberId, name: filteredSubscriber.name })
            expect(docSource.filteredSubscriptions[0]).toEqual(otherFilteredSubscriber)
            done()
          } catch (err) {
            done(err)
          }
        })
    })

    it('should move a filtered subscriber to globalSubscriptions when sending an empty filters object, and delete filteredSubscriptions if they are last', async function (done) {
      const feedId = 'someone send help'
      const filteredSubscriber = { id: subscriberId, name: 'adesxdfgbkljs', filters: { title: 'WHOOSH' } }
      const toSend = { id: subscriberId, filters: {} }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar',
          filteredSubscriptions: [ filteredSubscriber ]
        }
      } } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions/${subscriberId}`)
        .send(toSend)
        .expect(200)
        .end(async function (err, res) {
          if (err) return done(err)
          const source = res.body.sources[feedId]
          expect(source.filteredSubscriptions).toBeUndefined()
          expect(source.globalSubscriptions.length).toEqual(1)
          expect(source.globalSubscriptions[0]).toEqual({ id: subscriberId, name: filteredSubscriber.name })
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            const docSource = doc.sources[feedId]
            expect(docSource.filteredSubscriptions).toBeUndefined()
            expect(docSource.globalSubscriptions.length).toEqual(1)
            expect(docSource.globalSubscriptions[0]).toEqual({ id: subscriberId, name: filteredSubscriber.name })
            done()
          } catch (err) {
            done(err)
          }
        })
    })
  })

  describe('/DELETE /:subscriberId', function () {
    const subscriberId = 'gotta write more'
    it('remove the subscriber when they exist', async function (done) {
      const feedId = 'this is getting really long'
      const otherSubscriberId = 'it never ends'
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar',
          globalSubscriptions: [{ id: subscriberId }, { id: otherSubscriberId }]
        }
      } } }, { upsert: true })

      agent
        .delete(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions/${subscriberId}`)
        .expect(204)
        .end(async function (err, res) {
          if (err) return done(err)
          const doc = await models.GuildRss().findOne({ id: guildId })
          const docGlobalSubscriptions = doc.sources[feedId].globalSubscriptions
          expect(docGlobalSubscriptions.length).toBe(1)
          expect(docGlobalSubscriptions[0]).toEqual({ id: otherSubscriberId })
          done()
        })
    })

    it('remove the subscriber and delete the globalSubscribers when they are the last', async function (done) {
      const feedId = 'this is getting really long'
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar',
          globalSubscriptions: [{ id: subscriberId }]
        }
      } } }, { upsert: true })

      agent
        .delete(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions/${subscriberId}`)
        .expect(204)
        .end(async function (err, res) {
          if (err) return done(err)
          const doc = await models.GuildRss().findOne({ id: guildId })
          expect(doc.sources[feedId].globalSubscriptions).toBeUndefined()
          done()
        })
    })

    it('return a 400 code when subscriber does not exist', async function (done) {
      const feedId = 'this is getting really long'
      const expectedResponse = { code: 404, message: 'Unknown Subscriber' }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: {
          title: 'foobar',
          globalSubscriptions: [{ id: '123' }]
        }
      } } }, { upsert: true })

      agent
        .delete(`/api/guilds/${guildId}/feeds/${feedId}/subscriptions/${subscriberId}`)
        .expect(expectedResponse.code, expectedResponse, done)
    })
  })
  afterAll(function () {
    return models.GuildRss().deleteOne({ id: guildId })
  })
})
