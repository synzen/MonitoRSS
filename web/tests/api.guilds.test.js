/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const nock = require('nock')
const discordAPIConstants = require('../constants/discordAPI.js')
const guildsRoute = require('../routes/api/guilds')
const httpMocks = require('node-mocks-http')
const dbOpsGuilds = require('../../util/db/guilds.js')
const RedisGuild = require('../../structs/db/Redis/Guild.js')
const RedisGuildMember = require('../../structs/db/Redis/GuildMember.js')
const RedisRole = require('../../structs/db/Redis/Role.js')
const moment = require('moment-timezone')

jest.mock('../../util/db/guilds.js')
jest.mock('../../structs/db/Redis/Guild.js')
jest.mock('../../structs/db/Redis/GuildMember.js')
jest.mock('../../structs/db/Redis/Role.js')
jest.mock('moment-timezone')

RedisGuildMember.utils = {
  recognizeManagerManual: jest.fn(() => Promise.resolve()),
  recognizeManual: jest.fn(() => Promise.resolve()),
  recognizeNonMember: jest.fn(() => Promise.resolve())
}

RedisRole.utils = {
  isManagerOfGuild: jest.fn(() => Promise.resolve())
}

describe('/api/guilds', function () {
  const userID = '62368028891823362391'

  describe('GET /:guildID', function () {
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
        id: userID
      }
    }
    const params = {
      guildID: '9887'
    }
    afterEach(function () {
      RedisGuild.fetch.mockClear()
      RedisGuildMember.fetch.mockClear()
      RedisGuildMember.utils.recognizeManagerManual.mockClear()
      RedisGuildMember.utils.recognizeManual.mockClear()
      RedisGuildMember.utils.recognizeNonMember.mockClear()
    })
    describe('middleware', function () {
      it('returns 400 on no guild ID in param', async function () {
        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        await guildsRoute.middleware.checkUserGuildPermission(request, response)
        expect(response.statusCode).toEqual(400)
      })
      it('returns 404 on unknown guild', async function () {
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        RedisGuild.fetch.mockResolvedValueOnce(null)
        dbOpsGuilds.get.mockResolvedValueOnce(null)
        RedisGuildMember.fetch.mockResolvedValueOnce(null)
        await guildsRoute.middleware.checkUserGuildPermission(request, response)
        expect(response.statusCode).toEqual(404)
      })
      it('goes to next() as owner if guild is cached', async function (done) {
        const cachedGuild = { foo: 'bar', ownerID: session.identity.id }
        const guildRss = { joe: 'biden' }
        const cachedMember = { isManager: true }
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()

        RedisGuild.fetch.mockResolvedValueOnce({ toJSON: () => cachedGuild })
        dbOpsGuilds.get.mockResolvedValueOnce(guildRss)
        RedisGuildMember.fetch.mockResolvedValueOnce(cachedMember)

        await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
        expect(response.statusCode).toEqual(200)
      })
      it('attaches req.guildRss and req.guild', async function (done) {
        const cachedGuild = { foo: 'bar' }
        const guildRss = { joe: 'biden' }
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()

        RedisGuild.fetch.mockResolvedValueOnce({ toJSON: () => cachedGuild })
        dbOpsGuilds.get.mockResolvedValueOnce(guildRss)
        RedisGuildMember.fetch.mockResolvedValueOnce({ isManager: true })

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
      it('goes to next() as manager', async function (done) {
        const cachedGuild = { foo: 'bar' }
        const guildRss = { joe: 'biden' }
        const cachedMember = { isManager: true }
        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()

        RedisGuild.fetch.mockResolvedValueOnce({ toJSON: () => cachedGuild })
        dbOpsGuilds.get.mockResolvedValueOnce(guildRss)
        RedisGuildMember.fetch.mockResolvedValueOnce(cachedMember)

        await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
        expect(response.statusCode).toEqual(200)
      })
      it('returns 403 as non-manager', async function () {
        const cachedGuild = { foo: 'bar' }
        const guildRss = { joe: 'biden' }
        const cachedMember = { isManager: false }

        RedisGuild.fetch.mockResolvedValueOnce({ toJSON: () => cachedGuild })
        dbOpsGuilds.get.mockResolvedValueOnce(guildRss)
        RedisGuildMember.fetch.mockResolvedValueOnce(cachedMember)

        const request = httpMocks.createRequest({ session, params })
        const response = httpMocks.createResponse()
        await guildsRoute.middleware.checkUserGuildPermission(request, response)
        expect(response.statusCode).toEqual(403)
      })
    })
    describe('member is not cached as part of guild', function () {
      const cachedGuild = { foo: 'bar' }
      const guildRss = { joe: 'biden' }
      beforeEach(function () {
        RedisGuild.fetch.mockResolvedValueOnce({ toJSON: () => cachedGuild })
        dbOpsGuilds.get.mockResolvedValueOnce(guildRss)
        RedisGuildMember.fetch.mockResolvedValueOnce(null)
      })
      afterEach(function () {
        RedisGuild.fetch.mockReset()
        dbOpsGuilds.get.mockReset()
        RedisGuildMember.fetch.mockReset()
        RedisRole.utils.isManagerOfGuild.mockReset()
      })
      describe('Discord API call succeeds', function () {
        it('calls addNonManager and adds member to cache if they have no auth roles', async function () {
          const request = httpMocks.createRequest({ session, params })
          const response = httpMocks.createResponse()
          const discordAPIResponse = { roles: [] }
          nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildID}/members/${userID}`).reply(200, discordAPIResponse)
          await guildsRoute.middleware.checkUserGuildPermission(request, response)
          expect(RedisGuildMember.utils.recognizeManual).toHaveBeenCalledTimes(1)
        })
        it('returns 403 with API request with no eligible roles', async function () {
          const request = httpMocks.createRequest({ session, params })
          const response = httpMocks.createResponse()
          const discordAPIResponse = { roles: ['abc', 'def', 'ghi'] }
          nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildID}/members/${userID}`).reply(200, discordAPIResponse)
          RedisRole.utils.isManagerOfGuild.mockResolvedValueOnce(false)
          await guildsRoute.middleware.checkUserGuildPermission(request, response)
          expect(response.statusCode).toEqual(403)
        })
        it('calls recognizeManagerManual and adds user to cache if authorized', async function (done) {
          const request = httpMocks.createRequest({ session, params })
          const response = httpMocks.createResponse()
          const discordAPIResponse = { roles: ['abc', 'def', 'ghi'] }
          nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildID}/members/${userID}`).reply(200, discordAPIResponse)
          RedisRole.utils.isManagerOfGuild.mockResolvedValueOnce(true)
          await guildsRoute.middleware.checkUserGuildPermission(request, response, () => {
            try {
              expect(RedisGuildMember.utils.recognizeManagerManual).toHaveBeenCalledTimes(1)
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
          nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildID}/members/${userID}`).reply(200, discordAPIResponse)
          RedisRole.utils.isManagerOfGuild.mockResolvedValueOnce(true)
          await guildsRoute.middleware.checkUserGuildPermission(request, response, done)
          expect(response.statusCode).toEqual(200)
        })
      })
      describe('Discord API call fails', function () {
        it('calls recognizeNonMember if Discord API access returns 401', async function (done) {
          const request = httpMocks.createRequest({ session, params })
          const response = httpMocks.createResponse()
          nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildID}/members/${userID}`).reply(401, {})
          await guildsRoute.middleware.checkUserGuildPermission(request, response, () => {
            try {
              expect(RedisGuildMember.utils.recognizeNonMember).toHaveBeenCalledTimes(1)
              done()
            } catch (err) {
              done(err)
            }
          })
        })
        it('passes to next middleware if Discord API returns 401', async function (done) {
          const request = httpMocks.createRequest({ session, params })
          const response = httpMocks.createResponse()
          nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildID}/members/${userID}`).reply(401, {})
          await guildsRoute.middleware.checkUserGuildPermission(request, response, nextErr => {
            try {
              expect(nextErr).toBeDefined()
              done()
            } catch (err) {
              done(err)
            }
          })
        })
        it('calls addNonManager if Discord API access returns 403', async function (done) {
          const request = httpMocks.createRequest({ session, params })
          const response = httpMocks.createResponse()
          nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildID}/members/${userID}`).reply(403, {})
          await guildsRoute.middleware.checkUserGuildPermission(request, response, () => {
            try {
              expect(RedisGuildMember.utils.recognizeNonMember).toHaveBeenCalledTimes(1)
              done()
            } catch (err) {
              done(err)
            }
          })
        })
        it('passes to next middleware if Discord API returns 403', async function (done) {
          const request = httpMocks.createRequest({ session, params })
          const response = httpMocks.createResponse()
          nock(discordAPIConstants.apiHost).get(`/guilds/${params.guildID}/members/${userID}`).reply(403, {})
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
    describe('GET /:guildID', function () {
      it('returns 404 if no guildRss is found', function () {
        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        guildsRoute.routes.getGuildID(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
      })
      it('returns the guildRss JSON if it exists', function () {
        const guildRss = { foo: 'bzz' }
        const request = httpMocks.createRequest({ session, guildRss })
        const response = httpMocks.createResponse()
        guildsRoute.routes.getGuildID(request, response)
        expect(JSON.parse(response._getData())).toEqual(guildRss)
        expect(response._isJSON()).toEqual(true)
      })
    })

    describe('PATCH /:guildID', function () {
      afterEach(function () {
        moment.tz.zone.mockReset()
        dbOpsGuilds.update.mockReset()
        dbOpsGuilds.get.mockReset()
      })
      it('returns 404 if no guildRss is found', function () {
        const request = httpMocks.createRequest({ session, method: 'PATCH' })
        const response = httpMocks.createResponse()
        guildsRoute.routes.patchGuildID(request, response)
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
        await guildsRoute.routes.patchGuildID(request, response)
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
        await guildsRoute.routes.patchGuildID(request, response)
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
        await guildsRoute.routes.patchGuildID(request, response)
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
        await guildsRoute.routes.patchGuildID(request, response)
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
        await guildsRoute.routes.patchGuildID(request, response)
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
        await guildsRoute.routes.patchGuildID(request, response, nextErr => {
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
        await guildsRoute.routes.patchGuildID(request, response, nextErr => {
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
        await guildsRoute.routes.patchGuildID(request, response, nextErr => {
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
      it('calls guilRss update func on success', async function (done) {
        const body = { dateFormat: 'abc' }
        moment.tz.zone.mockReturnValueOnce(null)
        const request = httpMocks.createRequest({ session, body, guildRss: {}, method: 'PATCH' })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.patchGuildID(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(dbOpsGuilds.update).toHaveBeenCalledTimes(1)
            done()
          } catch (err) {
            done(err)
          }
        })
        expect(response.statusCode).toEqual(200)
      })
    })
    describe('DELETE /:guildID', function () {
      afterEach(function () {
        dbOpsGuilds.remove.mockReset()
      })
      it('returns 404 if no guildRss is found', function () {
        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        guildsRoute.routes.deleteGuildID(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
      })
      it('calls guildRss.remove if guildRss is found', async function (done) {
        const request = httpMocks.createRequest({ session, guildRss: {} })
        const response = httpMocks.createResponse()
        await guildsRoute.routes.deleteGuildID(request, response, nextErr => {
          if (nextErr) return done(nextErr)
          try {
            expect(dbOpsGuilds.remove).toHaveBeenCalledTimes(1)
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
  // const roleIDManageChannel = roleManageChannel.id
  // const roleIDAdministrator = roleAdministrator.id
  // const discordAPIRoutes = (guildID, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole) => [
  //   { route: `/guilds/${guildID}`, response: { owner_id: isOwner ? userID : userID + '123' } },
  //   { route: `/guilds/${guildID}/roles`, response: hasRoleInGuild ? [ roleManageChannel, roleAdministrator ] : [] },
  //   { route: `/guilds/${guildID}/members/${userID}`, response: { roles: [ hasManageChannelRole ? roleIDManageChannel : hasAdministratorRole ? roleIDAdministrator : 0 ] } }
  // ]
  // const mockDiscordAPIRoutes = (guildID, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole) => {
  //   discordAPIRoutes(guildID, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole).forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
  // }

  // describe('GET /:guildID', function () {
  //   const guildID = '5292010923'
  //   const guildRss = { id: guildID }
  //   // The user must meet two conditions to have access to this guild - they are either the owner, or has a role with MANAGE_CHANNELS permission
  //   beforeAll(function () {
  //     return models.GuildRss().updateOne({ id: guildID }, { $set: guildRss }, { upsert: true })
  //   })

  //   it('returns the guild for user as owner but no roles', function (done) {
  //     mockDiscordAPIRoutes(guildID, true)
  //     agent
  //       .get(`/api/guilds/${guildID}`)
  //       .expect(200, guildRss, done)
  //   })

  //   it('returns the guild for user with Manage Channels role', function (done) {
  //     mockDiscordAPIRoutes(guildID, false, true, true)
  //     agent
  //       .get(`/api/guilds/${guildID}`)
  //       .expect(200, guildRss, done)
  //   })

  //   it('returns a guild for user with Administrator role', function (done) {
  //     mockDiscordAPIRoutes(guildID, false, true, false, true)
  //     agent
  //       .get(`/api/guilds/${guildID}`)
  //       .expect(200, guildRss, done)
  //   })

  //   it('returns a 401 code for user with no role in guild', function (done) {
  //     mockDiscordAPIRoutes(guildID)
  //     agent
  //       .get(`/api/guilds/${guildID}`)
  //       .expect(401, done)
  //   })

  //   it('returns a 401 code for user with no role in guild and also not owner', function (done) {
  //     mockDiscordAPIRoutes(guildID, false, false, true, true)
  //     agent
  //       .get(`/api/guilds/${guildID}`)
  //       .expect(401, done)
  //   })

  //   afterAll(function () {
  //     return models.GuildRss().deleteOne(guildRss)
  //   })
  // })

  // describe('DELETE /:guildID', function () {
  //   const guildID = '2974936509'
  //   const guildRss = { id: guildID }
  //   beforeEach(async function () {
  //     mockDiscordAPIRoutes(guildID, true) // Just let the user be owner for these tests
  //     return models.GuildRss().deleteOne({ id: guildID })
  //   })
  //   it('returns a 204 code on success', async function (done) {
  //     await models.GuildRss().updateOne({ id: guildID }, { $set: guildRss }, { upsert: true })
  //     agent
  //       .delete(`/api/guilds/${guildID}`)
  //       .expect(204, done)
  //   })
  //   it('returns a 404 on no guild found', async function (done) {
  //     await models.GuildRss().deleteOne({ id: guildID })
  //     agent
  //       .delete(`/api/guilds/${guildID}`)
  //       .expect(404, done)
  //   })
  //   afterAll(function () {
  //     return models.GuildRss().deleteOne({ id: guildID })
  //   })
  // })

  // describe('PATCH /:guildID', function () {
  //   const guildID = '1003077591'
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
  //     return models.GuildRss().deleteOne({ id: guildID })
  //   })
  //   it('returns the updated guildRss with valid keys for an existent guildRss', async function (done) {
  //     await models.GuildRss().updateOne({ id: guildID }, { $set: { id: guildID } }, { upsert: true })
  //     mockDiscordAPIRoutes(guildID, true)
  //     agent
  //       .patch(`/api/guilds/${guildID}`)
  //       .send(correctlyModifyWith)
  //       .expect(200, { id: guildID, ...correctlyModifyWith }, done)
  //   })

  //   it('returns a 201 code with the updated guildRss with valid keys for a nonexistent guildRss', async function (done) {
  //     await models.GuildRss().deleteOne({ id: guildID })
  //     mockDiscordAPIRoutes(guildID, true)
  //     agent
  //       .patch(`/api/guilds/${guildID}`)
  //       .send(correctlyModifyWith)
  //       // .expect(res => console.log(res))
  //       .expect(201, { id: guildID, ...correctlyModifyWith }, done)
  //   })

  //   it('returns a 400 code for using wrong types on modifications with correct details', async function (done) {
  //     await models.GuildRss().updateOne({ id: guildID }, { $set: { id: guildID } }, { upsert: true })
  //     mockDiscordAPIRoutes(guildID, true)
  //     agent
  //       .patch(`/api/guilds/${guildID}`)
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
  //     return models.GuildRss().deleteOne({ id: guildID })
  //   })
  // })
})
