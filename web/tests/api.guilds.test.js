/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const nock = require('nock')
const discordAPIConstants = require('../constants/discordAPI.js')
const guildsRoute = require('../routes/api/guilds')
const httpMocks = require('node-mocks-http')
const dbOps = require('../../util/dbOps.js')
const redisOps = require('../../util/redisOps.js')
const moment = require('moment-timezone')

jest.mock('../../util/dbOps.js')
jest.mock('../../util/redisOps.js')
jest.mock('moment-timezone')

describe('/api/guilds', function () {
  const userId = '62368028891823362391'

  describe('GET /:guildId', function () {
    // it('returns 400 with no guild id in params', function (done) {
    //   agent
    //     .get('/api/guilds/')
    //     .expect(400)
    //     .end((err, res) => {
    //       if (err) return done(err)
    //       console.log(err)
    //       console.log(res.body)
    //       done()
    //     })
    // })
    const session = {
      identity: {
        id: userId
      }
    }
    const params = {
      guildId: '9887'
    }
    afterEach(function () {
      redisOps.guilds.getValue.mockClear()
      redisOps.members.isManagerOfGuild.mockClear()
      redisOps.members.isMemberOfGuild.mockClear()
      redisOps.members.isNotManagerOfGuild.mockClear()
      redisOps.guilds.get.mockClear()
      dbOps.guildRss.get.mockClear()
    })
    describe('middleware', function () {
      it('returns 400 on no guild ID in param', async function () {
        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        await guildsRoute.middleware.checkUserGuildPermission(request, response)
        expect(response.statusCode).toEqual(400)
      })
      it('attaches req.guildRss and req.guild', async function (done) {
        const cachedGuild = { foo: 'bar' }
        const guildRss = { joe: 'biden' }
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(null)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(true)
        redisOps.members.isMemberOfGuild.mockResolvedValueOnce(true)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(false)
        redisOps.guilds.get.mockResolvedValueOnce(cachedGuild)
        dbOps.guildRss.get.mockResolvedValueOnce(guildRss)
        await guildsRoute.middleware.checkUserGuildPermission(request, response, () => {
          try {
            expect(request.guildRss).toEqual(guildRss)
            expect(request.guild).toEqual(cachedGuild)
            done()
          } catch (err) {
            done(err)
          }
        })
      })
    })
    describe('member is cached as part of guild', function () {
      beforeEach(function () {
        redisOps.members.isMemberOfGuild.mockResolvedValueOnce(true)
        redisOps.guilds.get.mockResolvedValueOnce(null)
        dbOps.guildRss.get.mockResolvedValueOnce(null)
      })
      afterEach(function () {
        expect(redisOps.guilds.getValue).toHaveBeenNthCalledWith(1, params.guildId, 'ownerID')
        expect(redisOps.members.isManagerOfGuild).toHaveBeenNthCalledWith(1, userId, params.guildId)
        expect(redisOps.members.isMemberOfGuild).toHaveBeenNthCalledWith(1, userId, params.guildId)
        expect(redisOps.members.isNotManagerOfGuild).toHaveBeenNthCalledWith(1, userId, params.guildId)
        expect(redisOps.guilds.get).toHaveBeenNthCalledWith(1, params.guildId)
        expect(dbOps.guildRss.get).toHaveBeenNthCalledWith(1, params.guildId)
      })
      it('goes to next() as owner', async function (done) {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(userId)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(false)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(false)
        await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
        expect(response.statusCode).toEqual(200)
      })
      it('goes to next() as non-owner, cached as non-manager and is cached as manager', async function (done) {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(null)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(true)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(true)
        await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
        expect(response.statusCode).toEqual(200)
      })
      it('returns 401 as non-owner, cached as non-manager, and is not cached as manager', async function () {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(null)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(false)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(true)
        await guildsRoute.middleware.checkUserGuildPermission(request, response)
        expect(response.statusCode).toEqual(401)
      })
      it('goes to next() as non-owner, not cached as non-manager and is cached as manager', async function (done) {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(null)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(true)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(false)
        await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
        expect(response.statusCode).toEqual(200)
      })
      it('returns 401 as non-owner, not cached as non-manager and is not cached as manager', async function () {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(null)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(false)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(false)
        await guildsRoute.middleware.checkUserGuildPermission(request, response)
        expect(response.statusCode).toEqual(401)
      })
    })
    describe('member is not cached as part of guild', function () {
      beforeEach(function () {
        redisOps.members.isMemberOfGuild.mockResolvedValueOnce(false)
        redisOps.guilds.get.mockResolvedValueOnce(null)
        dbOps.guildRss.get.mockResolvedValueOnce(null)
      })
      it('goes to next() as owner', async function (done) {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(userId)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(false)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(false)
        await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
        expect(response.statusCode).toEqual(200)
      })
      it('returns 401 as non-owner, cached as non-manager and is cached as manager', async function () {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(null)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(true)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(true)
        await guildsRoute.middleware.checkUserGuildPermission(request, response)
        expect(response.statusCode).toEqual(401)
      })
      it('returns 401 as non-owner, cached as non-manager, and is not cached as manager', async function () {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(null)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(false)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(true)
        await guildsRoute.middleware.checkUserGuildPermission(request, response)
        expect(response.statusCode).toEqual(401)
      })
      it('goes to next() as non-owner, not cached as non-manager and is cached as manager', async function (done) {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        redisOps.guilds.getValue.mockResolvedValueOnce(null)
        redisOps.members.isManagerOfGuild.mockResolvedValueOnce(true)
        redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(false)
        await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
        expect(response.statusCode).toEqual(200)
      })
      describe('as non-owner, not cached as non-manager and is not cached as manager', function () {
        beforeEach(function () {
          redisOps.guilds.getValue.mockResolvedValueOnce(null)
          redisOps.members.isManagerOfGuild.mockResolvedValueOnce(null)
          redisOps.members.isNotManagerOfGuild.mockResolvedValueOnce(null)
        })
        afterEach(function () {
          redisOps.roles.isManagerOfGuild.mockReset()
          redisOps.members.addManagerManual.mockReset()
          redisOps.members.addNonManager.mockReset()
        })
        describe('Discord API call succeeds', function () {
          it('calls addNonManager and adds user to cache if unauthorized', async function () {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            const discordAPIResponse = { roles: [] }
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(200, discordAPIResponse)
            await guildsRoute.middleware.checkUserGuildPermission(request, response)
            expect(redisOps.members.addNonManager).toHaveBeenCalledTimes(1)
          })
          it('returns 401 with API request with no roles', async function () {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            const discordAPIResponse = { roles: [] }
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(200, discordAPIResponse)
            await guildsRoute.middleware.checkUserGuildPermission(request, response)
            expect(response.statusCode).toEqual(401)
          })
          it('returns 401 with API request with no eligible roles', async function () {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            const discordAPIResponse = { roles: ['abc', 'def', 'ghi'] }
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(200, discordAPIResponse)
            redisOps.roles.isManagerOfGuild.mockResolvedValue(0)
            await guildsRoute.middleware.checkUserGuildPermission(request, response)
            expect(response.statusCode).toEqual(401)
          })
          it('calls addManagerManual and adds user to cache if authorized', async function (done) {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            const discordAPIResponse = { roles: ['abc', 'def', 'ghi'] }
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(200, discordAPIResponse)
            redisOps.roles.isManagerOfGuild.mockResolvedValue(1)
            await guildsRoute.middleware.checkUserGuildPermission(request, response, () => {
              try {
                expect(redisOps.members.addManagerManual).toHaveBeenCalledTimes(1)
                done()
              } catch (err) {
                done(err)
              }
            })
          })
          it('calls next() with API request with eligible roles', async function (done) {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            const discordAPIResponse = { roles: ['abc', 'def', 'ghi'] }
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(200, discordAPIResponse)
            redisOps.roles.isManagerOfGuild.mockResolvedValue(1)
            await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
            expect(response.statusCode).toEqual(200)
          })
        })
        describe('Discord API call fails', function () {
          beforeEach(function () {
            redisOps.members.addNonManager.mockResolvedValueOnce(1)
          })
          it('calls addNonManager and adds user to cache if Discord API access returns 401', async function (done) {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(401, {})
            await guildsRoute.middleware.checkUserGuildPermission(request, response, () => {
              try {
                expect(redisOps.members.addNonManager).toHaveBeenCalledTimes(1)
                done()
              } catch (err) {
                done(err)
              }
            })
          })
          it('passes to next middleware if Discord API returns 401', async function (done) {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(401, {})
            await guildsRoute.middleware.checkUserGuildPermission(request, response, nextErr => {
              try {
                expect(nextErr).toBeDefined()
                done()
              } catch (err) {
                done(err)
              }
            })
          })
          it('calls addNonManager and adds user to cache if Discord API access returns 403', async function (done) {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(403, {})
            await guildsRoute.middleware.checkUserGuildPermission(request, response, () => {
              try {
                expect(redisOps.members.addNonManager).toHaveBeenCalledTimes(1)
                done()
              } catch (err) {
                done(err)
              }
            })
          })
          it('passes to next middleware if Discord API returns 403', async function (done) {
            const request = httpMocks.createRequest({ session, params })
            const response = httpMocks.createResponse()
            nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildId}/members/${userId}`).reply(403, {})
            await guildsRoute.middleware.checkUserGuildPermission(request, response, nextErr => {
              try {
                expect(nextErr).toBeDefined()
                done()
              } catch (err) {
                done(err)
              }
            })
          })
        })
      })
    })
    describe('GET /:guildId', function () {
      it('returns 404 if no guildRss is found', function () {
        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        guildsRoute.routes.getGuildId(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
      })
      it('returns the guildRss JSON if it exists', function () {
        const guildRss = { foo: 'bzz' }
        const request = httpMocks.createRequest({ session, guildRss })
        const response = httpMocks.createResponse()
        guildsRoute.routes.getGuildId(request, response)
        expect(JSON.parse(response._getData())).toEqual(guildRss)
        expect(response._isJSON()).toEqual(true)
      })
    })

    describe('PATCH /:guildId', function () {
      afterEach(function () {
        moment.tz.zone.mockReset()
        dbOps.guildRss.update.mockReset()
        dbOps.guildRss.get.mockReset()
      })
      it('returns 404 if no guildRss is found', function () {
        const request = httpMocks.createRequest({ session, method: 'PATCH' })
        const response = httpMocks.createResponse()
        guildsRoute.routes.patchGuildId(request, response)
        expect(response.statusCode).toEqual(404)
        expect(JSON.parse(response._getData()).code).toEqual(404)
      })
      it('returns 400 for invalid keys', async function () {
        const body = {
          invalid1: 'a',
          invalid2: { invalid3: 'b' },
          invalid3: null
        }
        const request = httpMocks.createRequest({ session, body, guildRss: {}, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildId(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        for (const key in body) {
          expect(data.message).toHaveProperty(key)
        }
      })
      it('returns 400 for invalid non-array key types', async function () {
        const body = {
          dateFormat: 1,
          dateLanguage: null,
          timezone: 1,
          prefix: undefined
        }
        const request = httpMocks.createRequest({ session, body, guildRss: {}, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildId(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        for (const key in body) {
          expect(data.message).toHaveProperty(key)
        }
      })
      it('returns 400 for invalid array key types', async function () {
        const body = {
          sendAlertsTo: 1
        }
        const request = httpMocks.createRequest({ session, body, guildRss: {}, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildId(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('sendAlertsTo')
      })
      it('returns 400 for array key types with invalid elements', async function () {
        const body = {
          sendAlertsTo: [123, null, undefined, '12']
        }
        const request = httpMocks.createRequest({ session, body, guildRss: {}, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildId(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('sendAlertsTo')
      })
      it('returns 400 for invalid timezone setting', async function () {
        const body = { timezone: 'abc' }
        moment.tz.zone.mockReturnValueOnce(null)
        const request = httpMocks.createRequest({ session, body, guildRss: {}, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildId(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('timezone')
      })
      it('deletes timezone from guildRss if body strings is equal to default', async function (done) {
        const timezone = 'foobar'
        const guildRss = { timezone }
        const body = { timezone }
        moment.tz.zone.mockReturnValue({ name: 'foobar-name' })
        const request = httpMocks.createRequest({ session, body, guildRss, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildId(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(guildRss.timezone).toEqual(undefined)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
      it('deletes keys from guildRss if body keys, except timezone, are empty strings', async function (done) {
        const guildRss = { sendAlertsTo: '1', dateFormat: '2', dateLanguage: '3', timezone: '4', prefix: '5' }
        const body = { sendAlertsTo: '', dateFormat: '', dateLanguage: '', prefix: '' }
        const expectedResponse = { timezone: guildRss.timezone }
        const request = httpMocks.createRequest({ session, body, guildRss, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildId(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(guildRss).toEqual(expectedResponse)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
      it('overwrites keys with valid body key values', async function (done) {
        const guildRss = { sendAlertsTo: '1', dateFormat: '2', dateLanguage: '3', timezone: '4', prefix: '5' }
        const body = { sendAlertsTo: ['jo', 'bo'], dateFormat: 'aaa', dateLanguage: 'bbb', prefix: 'ccc', timezone: 'ddd' }
        const request = httpMocks.createRequest({ session, body, guildRss, method: 'PATCH' })
        const response = httpMocks.createResponse()
        moment.tz.zone
          .mockImplementationOnce(arg => { return true })
          .mockImplementationOnce(arg => { return { name: 'foobar-name' } })
          .mockImplementationOnce(arg => { return { name: 'foobar-name-diff' } }) // Two different calls to indicate different timezones
        await guildsRoute.routes.patchGuildId(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(guildRss).toEqual(body)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
      it('calls guildRss.update on success', async function (done) {
        const body = { dateFormat: 'abc' }
        moment.tz.zone.mockReturnValueOnce(null)
        const request = httpMocks.createRequest({ session, body, guildRss: {}, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildId(request, response, nextErr => {
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
    describe('DELETE /:guildId', function () {
      afterEach(function () {
        dbOps.guildRss.remove.mockReset()
      })
      it('returns 404 if no guildRss is found', function () {
        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        guildsRoute.routes.deleteGuildId(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
      })
      it('calls guildRss.remove if guildRss is found', async function (done) {
        const request = httpMocks.createRequest({ session, guildRss: {} })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.deleteGuildId(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(dbOps.guildRss.remove).toHaveBeenCalledTimes(1)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
    })
  })

  // const roleManageChannel = {
  //   id: '8123',
  //   permissions: 372628561
  // }
  // const roleAdministrator = {
  //   id: '8124',
  //   permissions: 372628569
  // }
  // const roleIdManageChannel = roleManageChannel.id
  // const roleIdAdministrator = roleAdministrator.id
  // const discordAPIRoutes = (guildId, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole) => [
  //   { route: `/guilds/${guildId}`, response: { owner_id: isOwner ? userId : userId + '123' } },
  //   { route: `/guilds/${guildId}/roles`, response: hasRoleInGuild ? [ roleManageChannel, roleAdministrator ] : [] },
  //   { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [ hasManageChannelRole ? roleIdManageChannel : hasAdministratorRole ? roleIdAdministrator : 0 ] } }
  // ]
  // const mockDiscordAPIRoutes = (guildId, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole) => {
  //   discordAPIRoutes(guildId, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole).forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
  // }

  // describe('GET /:guildId', function () {
  //   const guildId = '5292010923'
  //   const guildRss = { id: guildId }
  //   // The user must meet two conditions to have access to this guild - they are either the owner, or has a role with MANAGE_CHANNELS permission
  //   beforeAll(function () {
  //     return models.GuildRss().updateOne({ id: guildId }, { $set: guildRss }, { upsert: true })
  //   })

  //   it('returns the guild for user as owner but no roles', function (done) {
  //     mockDiscordAPIRoutes(guildId, true)
  //     agent
  //       .get(`/api/guilds/${guildId}`)
  //       .expect(200, guildRss, done)
  //   })

  //   it('returns the guild for user with Manage Channels role', function (done) {
  //     mockDiscordAPIRoutes(guildId, false, true, true)
  //     agent
  //       .get(`/api/guilds/${guildId}`)
  //       .expect(200, guildRss, done)
  //   })

  //   it('returns a guild for user with Administrator role', function (done) {
  //     mockDiscordAPIRoutes(guildId, false, true, false, true)
  //     agent
  //       .get(`/api/guilds/${guildId}`)
  //       .expect(200, guildRss, done)
  //   })

  //   it('returns a 401 code for user with no role in guild', function (done) {
  //     mockDiscordAPIRoutes(guildId)
  //     agent
  //       .get(`/api/guilds/${guildId}`)
  //       .expect(401, done)
  //   })

  //   it('returns a 401 code for user with no role in guild and also not owner', function (done) {
  //     mockDiscordAPIRoutes(guildId, false, false, true, true)
  //     agent
  //       .get(`/api/guilds/${guildId}`)
  //       .expect(401, done)
  //   })

  //   afterAll(function () {
  //     return models.GuildRss().deleteOne(guildRss)
  //   })
  // })

  // describe('DELETE /:guildId', function () {
  //   const guildId = '2974936509'
  //   const guildRss = { id: guildId }
  //   beforeEach(async function () {
  //     mockDiscordAPIRoutes(guildId, true) // Just let the user be owner for these tests
  //     return models.GuildRss().deleteOne({ id: guildId })
  //   })
  //   it('returns a 204 code on success', async function (done) {
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: guildRss }, { upsert: true })
  //     agent
  //       .delete(`/api/guilds/${guildId}`)
  //       .expect(204, done)
  //   })
  //   it('returns a 404 on no guild found', async function (done) {
  //     await models.GuildRss().deleteOne({ id: guildId })
  //     agent
  //       .delete(`/api/guilds/${guildId}`)
  //       .expect(404, done)
  //   })
  //   afterAll(function () {
  //     return models.GuildRss().deleteOne({ id: guildId })
  //   })
  // })

  // describe('PATCH /:guildId', function () {
  //   const guildId = '1003077591'
  //   const correctlyModifyWith = {
  //     timezone: 'joey',
  //     prefix: 'asad',
  //     sendAlertsTo: ['123'],
  //     dateFormat: '243y',
  //     dateLanguage: 'qawsrfe'
  //   }
  //   const incorrectlyModifyWith = {
  //     timezone: 1,
  //     prefix: 1,
  //     sendAlertsTo: [[]],
  //     dateFormat: 1
  //   }
  //   beforeEach(function () {
  //     return models.GuildRss().deleteOne({ id: guildId })
  //   })
  //   it('returns the updated guildRss with valid keys for an existent guildRss', async function (done) {
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { id: guildId } }, { upsert: true })
  //     mockDiscordAPIRoutes(guildId, true)
  //     agent
  //       .patch(`/api/guilds/${guildId}`)
  //       .send(correctlyModifyWith)
  //       .expect(200, { id: guildId, ...correctlyModifyWith }, done)
  //   })

  //   it('returns a 201 code with the updated guildRss with valid keys for a nonexistent guildRss', async function (done) {
  //     await models.GuildRss().deleteOne({ id: guildId })
  //     mockDiscordAPIRoutes(guildId, true)
  //     agent
  //       .patch(`/api/guilds/${guildId}`)
  //       .send(correctlyModifyWith)
  //       // .expect(res => console.log(res))
  //       .expect(201, { id: guildId, ...correctlyModifyWith }, done)
  //   })

  //   it('returns a 400 code for using wrong types on modifications with correct details', async function (done) {
  //     await models.GuildRss().updateOne({ id: guildId }, { $set: { id: guildId } }, { upsert: true })
  //     mockDiscordAPIRoutes(guildId, true)
  //     agent
  //       .patch(`/api/guilds/${guildId}`)
  //       .send(incorrectlyModifyWith)
  //       // .expect(res => console.log(res))
  //       .expect(400)
  //       .end(function (err, res) {
  //         if (err) done(err)
  //         const body = res.body.message
  //         expect(body).toHaveProperty('timezone')
  //         expect(body).toHaveProperty('prefix')
  //         expect(body).toHaveProperty('sendAlertsTo')
  //         expect(body).toHaveProperty('dateFormat')
  //         expect(body).not.toHaveProperty('dateLanguage')
  //         done()
  //       })
  //   })
  //   afterAll(function () {
  //     return models.GuildRss().deleteOne({ id: guildId })
  //   })
  // })
})
