/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const guildFeedSubscribersRoute = require('../routes/api/guilds.feeds.subscribers.js')
const httpMocks = require('node-mocks-http')
const redisOps = require('../../util/redisOps.js')
const dbOps = require('../../util/dbOps.js')

jest.mock('../../util/redisOps.js')
jest.mock('../../util/dbOps.js')

describe('/api/guilds/:guildId/feeds/:feedId/subscribers', function () {
  const userId = 'georgie'
  const session = {
    identity: {
      id: userId
    }
  }
  const params = {
    guildId: '9887',
    feedId: '325re0whdn', // Add this just in case, even though it's not needed in any of the routes
    subscriberId: '235t0uih34t'
  }
  describe('middleware checkSubscriptionExist', function () {
    it('returns 404 if subscriber is not found with no other subscribers', function () {
      const source = {}
      const request = httpMocks.createRequest({ session, params, source })
      const response = httpMocks.createResponse()
      guildFeedSubscribersRoute.middleware.checkSubscriptionExist(request, response)
      expect(response.statusCode).toEqual(404)
      const data = JSON.parse(response._getData())
      expect(data.message).toEqual('Unknown Subscriber')
    })
    it('returns 404 if subscriber is not found with other subscribers existent', function () {
      const source = {
        subscribers: [{ id: 'sdf' }, { id: 'dszxfbhng' }]
      }
      const request = httpMocks.createRequest({ session, params, source })
      const response = httpMocks.createResponse()
      guildFeedSubscribersRoute.middleware.checkSubscriptionExist(request, response)
      expect(response.statusCode).toEqual(404)
      const data = JSON.parse(response._getData())
      expect(data.message).toEqual('Unknown Subscriber')
    })
    it('calls next() if subscriber is found as global subscriber', function (done) {
      const source = {
        subscribers: [{ id: 'sdf' }, { id: params.subscriberId }, { id: 'dszxfbhng' }]
      }
      const request = httpMocks.createRequest({ session, params, source })
      const response = httpMocks.createResponse()
      guildFeedSubscribersRoute.middleware.checkSubscriptionExist(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
    it('calls next() if subscriber is found as filtered subscriber', function (done) {
      const source = {
        subscribers: [{ id: 'sdf' }, { id: params.subscriberId, filters: { title: 'woohoo' } }]
      }
      const request = httpMocks.createRequest({ session, params, source })
      const response = httpMocks.createResponse()
      guildFeedSubscribersRoute.middleware.checkSubscriptionExist(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
  })

  describe('PUT /', function () {
    afterEach(function () {
      redisOps.roles.isRoleOfGuild.mockReset()
      redisOps.roles.getValue.mockReset()
      dbOps.guildRss.update.mockReset()
    })
    it('returns 400 if no id is found in body', async function () {
      const body = { type: 'role' }
      const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
      const response = httpMocks.createResponse()
      await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('id')
      expect(data.message.id).toEqual('This field is required')
    })
    it('returns 400 if type in body is not "role"', async function () {
      const body = { id: '123', type: null }
      const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
      const response = httpMocks.createResponse()
      await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('type')
      expect(data.message.type).toEqual('Must be "role"')
    })
    it('returns 403 if role is not part of guild', async function () {
      const body = { id: '123', type: 'role' }
      const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
      const response = httpMocks.createResponse()
      redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(false)
      redisOps.roles.getValue.mockResolvedValueOnce(null)
      await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
      expect(response.statusCode).toEqual(403)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(403)
      expect(data.message.includes('in guild')).toEqual(true)
    })
    it('returns 403 if cached role name is @everyone', async function () {
      const body = { id: '123', type: 'role' }
      const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
      const response = httpMocks.createResponse()
      redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
      redisOps.roles.getValue.mockResolvedValueOnce('@everyone')
      await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
      expect(response.statusCode).toEqual(403)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(403)
      expect(data.message.includes('cannot be a subscriber')).toEqual(true)
    })
    describe('with no filters', function () {
      it('returns 201 with the added role object on success', async function () {
        const roleName = 'foobar'
        const body = { id: '123', type: 'role' }
        const source = {}
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, source, method: 'PUT' })
        const response = httpMocks.createResponse()
        const expectedResponse = { ...body, name: roleName }
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce(roleName)
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(201)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(expectedResponse)
      })
      it('adds the subscriptions array if it does not exist', async function () {
        const roleName = 'foobar'
        const body = { id: '123', type: 'role' }
        const source = {}
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, source, method: 'PUT' })
        const response = httpMocks.createResponse()
        const addedRole = { ...body, name: roleName }
        const expectedSource = {
          subscribers: [ addedRole ]
        }
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce(roleName)
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(201)
        expect(source).toEqual(expectedSource)
      })
      it('calls guildRss.update', async function () {
        const roleName = 'foobar'
        const body = { id: '123', type: 'role' }
        const source = {}
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, source, method: 'PUT' })
        const response = httpMocks.createResponse()
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce(roleName)
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(dbOps.guildRss.update).toHaveBeenCalledTimes(1)
      })
    })
    describe('with filters', function () {
      it('returns 400 if filters in body is null', async function () {
        const body = { id: '123', type: 'role', filters: null }
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
        const response = httpMocks.createResponse()
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce('foobar')
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('filters')
      })
      it('returns 400 if filters is an array', async function () {
        const body = { id: '123', type: 'role', filters: [1, 2, 3] }
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
        const response = httpMocks.createResponse()
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce('foobar')
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('filters')
      })
      it('returns 400 if filters is a string', async function () {
        const body = { id: '123', type: 'role', filters: '123' }
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
        const response = httpMocks.createResponse()
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce('foobar')
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('filters')
      })
      it('returns 400 if filters is a number', async function () {
        const body = { id: '123', type: 'role', filters: 123 }
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
        const response = httpMocks.createResponse()
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce('foobar')
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('filters')
      })
      it('returns 400 if filters is a string', async function () {
        const body = { id: '123', type: 'role', filters: true }
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
        const response = httpMocks.createResponse()
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce('foobar')
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('filters')
      })
      it('returns 400 if filters is an empty object', async function () {
        const body = { id: '123', type: 'role', filters: {} }
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, method: 'PUT' })
        const response = httpMocks.createResponse()
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce('foobar')
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('filters')
      })
      it('returns 201 with the added role object on success', async function () {
        const roleName = 'foobar'
        const body = { id: '123', type: 'role', filters: { ho: ['dunk'] } }
        const source = {}
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, source, method: 'PUT' })
        const response = httpMocks.createResponse()
        const expectedResponse = { ...body, name: roleName }
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce(roleName)
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(201)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(expectedResponse)
      })
      it('calls guildRss.update', async function () {
        const roleName = 'foobar'
        const body = { id: '123', type: 'role', filters: { ho: ['dunk'] } }
        const source = {}
        const request = httpMocks.createRequest({ session, params, body, guildRss: {}, source, method: 'PUT' })
        const response = httpMocks.createResponse()
        redisOps.roles.isRoleOfGuild.mockResolvedValueOnce(true)
        redisOps.roles.getValue.mockResolvedValueOnce(roleName)
        await guildFeedSubscribersRoute.routes.putFeedSubscription(request, response)
        expect(response.statusCode).toEqual(201)
        expect(dbOps.guildRss.update).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('PATCH /', function () {
    afterEach(function () {
      dbOps.guildRss.update.mockReset()
    })
    it('returns 400 if filters is not a key', async function () {
      const body = {}
      const request = httpMocks.createRequest({ session, params, body, method: 'PATCH' })
      const response = httpMocks.createResponse()
      await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('filters')
      expect(data.message.filters).toEqual('Must be populated if not an empty string')
    })
    it('returns 400 if filters is a boolean', async function () {
      const body = { filters: true }
      const request = httpMocks.createRequest({ session, params, body, method: 'PATCH' })
      const response = httpMocks.createResponse()
      await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('filters')
      expect(data.message.filters).toEqual('Must be an object')
    })
    it('returns 400 if filters is an array', async function () {
      const body = { filters: [] }
      const request = httpMocks.createRequest({ session, params, body, method: 'PATCH' })
      const response = httpMocks.createResponse()
      await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('filters')
      expect(data.message.filters).toEqual('Must be an object')
    })
    it('returns 400 if filters is a populated string', async function () {
      const body = { filters: '3214' }
      const request = httpMocks.createRequest({ session, params, body, method: 'PATCH' })
      const response = httpMocks.createResponse()
      await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('filters')
      expect(data.message.filters).toEqual('Must be an object')
    })
    it('returns 400 if filters is null', async function () {
      const body = { filters: null }
      const request = httpMocks.createRequest({ session, params, body, method: 'PATCH' })
      const response = httpMocks.createResponse()
      await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('filters')
      expect(data.message.filters).toEqual('Must be populated if not an empty string')
    })
    it('returns 400 if filters is an empty object', async function () {
      const body = { filters: {} }
      const request = httpMocks.createRequest({ session, params, body, method: 'PATCH' })
      const response = httpMocks.createResponse()
      await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('filters')
      expect(data.message.filters).toEqual('Must be populated')
    })
    describe('with valid filter keys on a global subscriber', function () {
      it('returns 400 if filters is an empty string', async function () {
        const body = { filters: '' }
        const source = {
          subscribers: [{ id: params.subscriberId }]
        }
        const request = httpMocks.createRequest({ session, params, subscriberIndex: 0, body, source, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toEqual('Already a global subscriber')
      })
      it('calls guildRss.update', async function (done) {
        const body = { filters: { ho: 'dunk' } }
        const source = {
          subscribers: [{ id: params.subscriberId }, { id: 'srfdhye' }]
        }
        const subscriberIndex = 0
        const request = httpMocks.createRequest({ session, params, source, subscriberIndex, body, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(dbOps.guildRss.update).toHaveBeenCalledTimes(1)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
    })
    describe('with empty filter string in body on a filtered subscriber', function () {
      const body = { filters: '' }
      it('calls guildRss.update', async function (done) {
        const source = {
          subscribers: [{ id: params.subscriberId, filters: { huu: 'd' } }, { id: 'srfdhye', filters: { fu: 'bar' } }]
        }
        const subscriberIndex = 0
        const request = httpMocks.createRequest({ session, params, source, subscriberIndex, body, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(dbOps.guildRss.update).toHaveBeenCalledTimes(1)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
    })
    describe('with populated filter object in body on a filtered subscriber', function () {
      it('overwrites the subscriber filters with no other filtered subscribers', async function (done) {
        const body = { filters: { chicken: 'dinner' } }
        const source = {
          subscribers: [{ id: params.subscriberId, filters: { ho: 'du' } }]
        }
        const expectedSource = {
          subscribers: [{ id: params.subscriberId, ...body }]
        }
        const subscriberIndex = 0
        const request = httpMocks.createRequest({ session, params, source, subscriberIndex, body, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(source).toEqual(expectedSource)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
      it('overwrites the subscriber filters with other filtered subscribers', async function (done) {
        const body = { filters: { chicken: 'dinner' } }
        const source = {
          subscribers: [{ id: 'whatever', filters: { fo: 'ba' } }, { id: params.subscriberId, filters: { ho: 'du' } }]
        }
        const expectedSource = {
          subscribers: [{ ...source.subscribers[0] }, { id: params.subscriberId, ...body }]
        }
        const subscriberIndex = 1
        const request = httpMocks.createRequest({ session, params, source, subscriberIndex, body, method: 'PATCH' })
        const response = httpMocks.createResponse()

        await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(source).toEqual(expectedSource)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
      it('calls guildRss.update', async function (done) {
        const body = { filters: { chicken: 'dinner' } }
        const source = {
          subscribers: [{ id: params.subscriberId, filters: { ho: 'du' } }]
        }
        const subscriberIndex = 0
        const request = httpMocks.createRequest({ session, params, source, subscriberIndex, body, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildFeedSubscribersRoute.routes.patchFeedSubscription(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(dbOps.guildRss.update).toHaveBeenCalledTimes(1)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
    })
  })
  // const roles = [
  //   { id: 'role1', name: 'role1name' },
  //   { id: 'role2', name: 'role2name' },
  //   { id: 'role3', name: 'role3name' }]
  // const discordAPIRoutes = [
  //   { route: `/guilds/${guildId}`, response: { owner_id: userId } },
  //   { route: `/guilds/${guildId}/roles`, response: roles },
  //   { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [] } }]
  // beforeEach(function () {
  //   discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
  // })
  // beforeAll(async function (done) {
  //   agent
  //     .post('/session')
  //     .send({
  //       auth: { access_token: 'foobunk' },
  //       identity: { id: userId }
  //     })
  //     .expect(200, done)
  // })

  // describe('POST /', function () {
  //   it('adds global role subscription and returns the result when valid role', async function (done) {
  //     const chosenRole = roles[2]
  //     const expectedResult = { type: 'role', id: chosenRole.id, name: chosenRole.name }
  //     const feedId = 'HWATBOBBY'
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar'
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .post(`/api/guilds/${guildId}/feeds/${feedId}/subscribers`)
  //       .send({ type: 'role', id: chosenRole.id })
  //       .expect(201)
  //       .end(async function (err, res) {
  //         if (err) return done(err)
  //         expect(res.body).toEqual(expectedResult)
  //         expect(res.body.filters).toBe(expectedResult.filters)
  //         try {
  //           const doc = await models.GuildRss().findOne({ id: guildId })
  //           if (!doc) return done(new Error('Document is missing'))
  //           const docArr = doc.sources[feedId].globalSubscriptions
  //           expect(docArr.constructor.name).toBe('Array')
  //           expect(docArr.length).toBe(1)
  //           expect(docArr[0]).toEqual(expectedResult)
  //           done()
  //         } catch (err) {
  //           done(err)
  //         }
  //       })
  //   })
  //   it('adds global user subscription and returns the result when valid user', async function (done) {
  //     const userId = 'louisId'
  //     const userName = 'louisName'
  //     const expectedResult = { type: 'user', id: userId, name: userName, filters: { title: 'hwat', description: 'dangit bobby' } }
  //     const feedId = 'HWATBOBBYAGAIN'
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/users/${userId}`)
  //       .reply(200, { username: userName })
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar'
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .post(`/api/guilds/${guildId}/feeds/${feedId}/subscribers`)
  //       .send({ type: 'user', id: userId, filters: expectedResult.filters })
  //       .expect(201)
  //       .end(async function (err, res) {
  //         if (err) return done(err)
  //         expect(res.body).toEqual(expectedResult)
  //         expect(res.body.filters).toBe(res.body.filters)
  //         try {
  //           const doc = await models.GuildRss().findOne({ id: guildId })
  //           if (!doc) return done(new Error('Document is missing'))
  //           const docArr = doc.sources[feedId].filteredSubscriptions
  //           expect(docArr.constructor.name).toBe('Array')
  //           expect(docArr.length).toBe(1)
  //           expect(docArr[0]).toEqual(expectedResult)
  //           expect(docArr[0].filters).toEqual(expectedResult.filters)
  //           done()
  //         } catch (err) {
  //           done(err)
  //         }
  //       })
  //   })

  //   it('returns with discord status and message for invalid user subscription', async function (done) {
  //     const userId = 'kaplooeyoooooo'
  //     const feedId = 'HWATBOBBYAGAINDANGIT'
  //     const discordMessage = { code: 400, message: 'A different discord message' }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/users/${userId}`)
  //       .reply(discordMessage.code, { message: discordMessage.message })
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar'
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .post(`/api/guilds/${guildId}/feeds/${feedId}/subscribers`)
  //       .send({ type: 'user', id: userId })
  //       .expect(discordMessage.code, { ...discordMessage, discord: true }, done)
  //   })

  //   it('returns a 403 code for invalid role subscription', async function (done) {
  //     const feedId = 'GETTIN ME RILED UP BOBBY'
  //     const chosenRole = roles[0]
  //     const expectedResponse = { code: 403, message: { id: 'Role is not in guild' } }
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar'
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .post(`/api/guilds/${guildId}/feeds/${feedId}/subscribers`)
  //       .send({ type: 'role', id: chosenRole.id + 'garbage' })
  //       .expect(expectedResponse.code, expectedResponse, done)
  //   })

  //   it('returns a 400 code for missing id', async function (done) {
  //     const feedId = 'GETTIN ME RILED UP BOBBY AGAIN'
  //     const expectedResponse = { code: 400, message: { id: 'This field is required' } }
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar'
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .post(`/api/guilds/${guildId}/feeds/${feedId}/subscribers`)
  //       .send({ type: 'role' })
  //       .expect(expectedResponse.code, expectedResponse, done)
  //   })

  //   it('returns a 400 code for missing/invalid type', async function (done) {
  //     const feedId = 'GETTIN ME RILED UP BOBBY AGAIN X2'
  //     const expectedResponse = { code: 400, message: { type: 'Must be "role" or "user"' } }
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar'
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .post(`/api/guilds/${guildId}/feeds/${feedId}/subscribers`)
  //       .send({ id: 'asd' })
  //       .expect(expectedResponse.code, expectedResponse, done)
  //   })
  // })

  // describe('/PATCH /:subscriberId', function () {
  //   const subscriberId = '*gets down on my feet*'
  //   it('should move a global subscriber to filteredSubscriptions when sending a populated filters object', async function (done) {
  //     const feedId = 'someone send help'
  //     const globalSubscriber = { id: subscriberId, name: 'adesxdfgbkljs' }
  //     const otherGlobalSubscriber = { id: subscriberId + 1, name: globalSubscriber.name + 1 }
  //     const toSend = { id: subscriberId, filters: { title: 'aidesgbhdhnj' } }
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar',
  //         globalSubscriptions: [ globalSubscriber, otherGlobalSubscriber ]
  //       }
  //     } } }, { upsert: true })
  //     agent
  //       .patch(`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${subscriberId}`)
  //       .send(toSend)
  //       .expect(200)
  //       .end(async function (err, res) {
  //         if (err) return done(err)
  //         const source = res.body.sources[feedId]
  //         expect(source.globalSubscriptions.length).toBe(1)
  //         expect(source.filteredSubscriptions.length).toBe(1)
  //         expect(source.filteredSubscriptions[0]).toEqual({ ...globalSubscriber, filters: toSend.filters })
  //         expect(source.globalSubscriptions[0]).toEqual(otherGlobalSubscriber)
  //         try {
  //           const doc = await models.GuildRss().findOne({ id: guildId })
  //           const docSource = doc.sources[feedId]
  //           expect(docSource.globalSubscriptions.length).toBe(1)
  //           expect(docSource.filteredSubscriptions.length).toBe(1)
  //           expect(docSource.filteredSubscriptions[0]).toEqual({ ...globalSubscriber, filters: toSend.filters })
  //           expect(docSource.globalSubscriptions[0]).toEqual(otherGlobalSubscriber)
  //           done()
  //         } catch (err) {
  //           done(err)
  //         }
  //       })
  //   })

  //   it('should move a global subscriber to filteredSubscriptions when sending a populated filters object, and delete filteredSubscriptions if they are last', async function (done) {
  //     const feedId = 'someone send help'
  //     const globalSubscriber = { id: subscriberId, name: 'adesxdfgbkljs' }
  //     const toSend = { id: subscriberId, filters: { title: 'aidesgbhdhnj' } }
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar',
  //         globalSubscriptions: [ globalSubscriber ]
  //       }
  //     } } }, { upsert: true })
  //     agent
  //       .patch(`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${subscriberId}`)
  //       .send(toSend)
  //       .expect(200)
  //       .end(async function (err, res) {
  //         if (err) return done(err)
  //         const source = res.body.sources[feedId]
  //         expect(source.globalSubscriptions).toBeUndefined()
  //         expect(source.filteredSubscriptions.length).toEqual(1)
  //         expect(source.filteredSubscriptions[0]).toEqual({ ...globalSubscriber, filters: toSend.filters })
  //         try {
  //           const doc = await models.GuildRss().findOne({ id: guildId })
  //           const docSource = doc.sources[feedId]
  //           expect(docSource.globalSubscriptions).toBeUndefined()
  //           expect(docSource.filteredSubscriptions.length).toEqual(1)
  //           expect(docSource.filteredSubscriptions[0]).toEqual({ ...globalSubscriber, filters: toSend.filters })
  //           done()
  //         } catch (err) {
  //           done(err)
  //         }
  //       })
  //   })

  //   it('should move a filtered subscriber to globalSubscriptions when sending an empty filters object', async function (done) {
  //     const feedId = 'someone send help'
  //     const filteredSubscriber = { id: subscriberId, name: 'adesxdfgbkljs', filters: { title: 'WHOOSH' } }
  //     const otherFilteredSubscriber = { id: subscriberId + 1, name: filteredSubscriber.name + 1, filters: { title: 'WHOOSH2' } }
  //     const toSend = { id: subscriberId, filters: {} }
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar',
  //         filteredSubscriptions: [ filteredSubscriber, otherFilteredSubscriber ]
  //       }
  //     } } }, { upsert: true })
  //     agent
  //       .patch(`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${subscriberId}`)
  //       .send(toSend)
  //       .expect(200)
  //       .end(async function (err, res) {
  //         if (err) return done(err)
  //         const source = res.body.sources[feedId]
  //         expect(source.filteredSubscriptions.length).toBe(1)
  //         expect(source.globalSubscriptions.length).toEqual(1)
  //         expect(source.globalSubscriptions[0]).toEqual({ id: subscriberId, name: filteredSubscriber.name })
  //         expect(source.filteredSubscriptions[0]).toEqual(otherFilteredSubscriber)
  //         try {
  //           const doc = await models.GuildRss().findOne({ id: guildId })
  //           const docSource = doc.sources[feedId]
  //           expect(docSource.filteredSubscriptions.length).toBe(1)
  //           expect(docSource.globalSubscriptions.length).toEqual(1)
  //           expect(docSource.globalSubscriptions[0]).toEqual({ id: subscriberId, name: filteredSubscriber.name })
  //           expect(docSource.filteredSubscriptions[0]).toEqual(otherFilteredSubscriber)
  //           done()
  //         } catch (err) {
  //           done(err)
  //         }
  //       })
  //   })

  //   it('should move a filtered subscriber to globalSubscriptions when sending an empty filters object, and delete filteredSubscriptions if they are last', async function (done) {
  //     const feedId = 'someone send help'
  //     const filteredSubscriber = { id: subscriberId, name: 'adesxdfgbkljs', filters: { title: 'WHOOSH' } }
  //     const toSend = { id: subscriberId, filters: {} }
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar',
  //         filteredSubscriptions: [ filteredSubscriber ]
  //       }
  //     } } }, { upsert: true })
  //     agent
  //       .patch(`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${subscriberId}`)
  //       .send(toSend)
  //       .expect(200)
  //       .end(async function (err, res) {
  //         if (err) return done(err)
  //         const source = res.body.sources[feedId]
  //         expect(source.filteredSubscriptions).toBeUndefined()
  //         expect(source.globalSubscriptions.length).toEqual(1)
  //         expect(source.globalSubscriptions[0]).toEqual({ id: subscriberId, name: filteredSubscriber.name })
  //         try {
  //           const doc = await models.GuildRss().findOne({ id: guildId })
  //           const docSource = doc.sources[feedId]
  //           expect(docSource.filteredSubscriptions).toBeUndefined()
  //           expect(docSource.globalSubscriptions.length).toEqual(1)
  //           expect(docSource.globalSubscriptions[0]).toEqual({ id: subscriberId, name: filteredSubscriber.name })
  //           done()
  //         } catch (err) {
  //           done(err)
  //         }
  //       })
  //   })
  // })

  // describe('/DELETE /:subscriberId', function () {
  //   const subscriberId = 'gotta write more'
  //   it('remove the subscriber when they exist', async function (done) {
  //     const feedId = 'this is getting really long'
  //     const otherSubscriberId = 'it never ends'
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar',
  //         globalSubscriptions: [{ id: subscriberId }, { id: otherSubscriberId }]
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .delete(`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${subscriberId}`)
  //       .expect(204)
  //       .end(async function (err, res) {
  //         if (err) return done(err)
  //         const doc = await models.GuildRss().findOne({ id: guildId })
  //         const docGlobalSubscriptions = doc.sources[feedId].globalSubscriptions
  //         expect(docGlobalSubscriptions.length).toBe(1)
  //         expect(docGlobalSubscriptions[0]).toEqual({ id: otherSubscriberId })
  //         done()
  //       })
  //   })

  //   it('remove the subscriber and delete the globalSubscribers when they are the last', async function (done) {
  //     const feedId = 'this is getting really long'
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar',
  //         globalSubscriptions: [{ id: subscriberId }]
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .delete(`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${subscriberId}`)
  //       .expect(204)
  //       .end(async function (err, res) {
  //         if (err) return done(err)
  //         const doc = await models.GuildRss().findOne({ id: guildId })
  //         expect(doc.sources[feedId].globalSubscriptions).toBeUndefined()
  //         done()
  //       })
  //   })

  //   it('return a 400 code when subscriber does not exist', async function (done) {
  //     const feedId = 'this is getting really long'
  //     const expectedResponse = { code: 404, message: 'Unknown Subscriber' }
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
  //       [feedId]: {
  //         title: 'foobar',
  //         globalSubscriptions: [{ id: '123' }]
  //       }
  //     } } }, { upsert: true })

  //     agent
  //       .delete(`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${subscriberId}`)
  //       .expect(expectedResponse.code, expectedResponse, done)
  //   })
  // })
  // afterAll(function () {
  //   return models.GuildRss().deleteOne({ id: guildId })
  // })
})
