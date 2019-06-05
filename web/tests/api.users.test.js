/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

// const request = require('supertest')
const httpMocks = require('node-mocks-http')
// const app = require('../index.js')
// const config = require('../../config.js')
// const models = require('../../util/storage.js').models
// const nock = require('nock')
// const discordAPIConstants = require('../constants/discordAPI.js')
// const agent = request.agent(app())
const fetchUser = require('../util/fetchUser.js')
const dbOps = require('../../util/dbOps.js')
const redisOps = require('../../util/redisOps.js')
const userRoute = require('../routes/api/users.js')

// config.feeds.max = 1000
jest.mock('../util/fetchUser.js')
jest.mock('../../util/dbOps.js')
jest.mock('../../util/redisOps.js')

describe('/api/users', function () {
  const userId = '53377393422652091224'
  const accessToken = '95740162964886851841'
  // beforeAll(async function (done) {
  //   agent
  //     .post('/session')
  //     .send({
  //       auth: { access_token: accessToken },
  //       identity: { id: userId }
  //     })
  //     .expect(200, done)
  // })
  const session = {
    identity: {
      id: userId
    },
    auth: {
      access_token: accessToken
    }
  }
  describe('GET /@me', function () {
    it('returns with redis response if user is cached', async function () {
      const redisResponse = { username: '12325' }
      redisOps.users.get.mockResolvedValueOnce(redisResponse)
      const request = httpMocks.createRequest({ session })
      const response = httpMocks.createResponse()
      await userRoute.routes.getMe(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(redisResponse)
    })
    it(`returns Discord API's response if user is not cached`, async function () {
      const discordResponse = { foo: 'bar', dinkle: 'berry' }
      const request = httpMocks.createRequest({ session })
      const response = httpMocks.createResponse()
      fetchUser.info.mockResolvedValueOnce(discordResponse)
      await userRoute.routes.getMe(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(discordResponse)
    })
  })

  describe('GET /@bot', function () {
    it('returns the redis response if cached', async function () {
      const redisResponse = { foo: 'baz' }
      redisOps.users.get.mockResolvedValueOnce(redisResponse)
      const request = httpMocks.createRequest({ session })
      const response = httpMocks.createResponse()
      await userRoute.routes.getBot(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(redisResponse)
    })
    it('returns empty object if uncached', async function () {
      redisOps.users.get.mockResolvedValueOnce(null)
      const request = httpMocks.createRequest({ session })
      const response = httpMocks.createResponse()
      await userRoute.routes.getBot(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual({})
    })

    describe('GET /@me/guilds', function () {
      const MANAGE_CHANNEL_PERMISSION = 16
      const ADMINISTRATOR_PERMISSION = 8
      afterEach(function () {
        fetchUser.guilds.mockClear()
        redisOps.guilds.exists.mockClear()
        dbOps.guildRss.get.mockClear()
      })
      it('returns no guilds if no API guilds are in cache', async function () {
        const apiGuilds = [
          { id: '1' }
        ]
        fetchUser.guilds.mockResolvedValueOnce(apiGuilds)
        redisOps.guilds.exists.mockResolvedValueOnce(0)
        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        await userRoute.routes.getMeGuilds(request, response)
        expect(response.statusCode).toEqual(200)
        const data = JSON.parse(response._getData())
        expect(data).toEqual([])
      })
      it('returns only guilds that user is owner of', async function () {
        const apiGuilds = [
          { id: '1', owner: true },
          { id: '2', owner: false }
        ]
        const guildRsses = [
          { foo: 'bar' },
          { foo: 'baz' }
        ]
        const expectedResponse = [
          {
            discord: apiGuilds[0],
            profile: guildRsses[0]
          }
        ]
        fetchUser.guilds.mockResolvedValueOnce(apiGuilds)
        redisOps.guilds.exists.mockResolvedValueOnce(1)
        redisOps.guilds.exists.mockResolvedValueOnce(1)
        dbOps.guildRss.get.mockResolvedValueOnce(guildRsses[0])

        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        await userRoute.routes.getMeGuilds(request, response)
        expect(response.statusCode).toEqual(200)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(expectedResponse)
      })
      it('returns only guilds that user has MANAGE_CHANNEL permissions in', async function () {
        const apiGuilds = [
          { id: '2', permissions: MANAGE_CHANNEL_PERMISSION },
          { id: '1', permissions: 0 }
        ]
        const guildRsses = [
          { foo: 'bar' },
          { foo: 'baz' }
        ]
        const expectedResponse = [
          {
            discord: apiGuilds[0],
            profile: guildRsses[0]
          }
        ]
        fetchUser.guilds.mockResolvedValueOnce(apiGuilds)
        redisOps.guilds.exists.mockResolvedValueOnce(1)
        redisOps.guilds.exists.mockResolvedValueOnce(1)

        dbOps.guildRss.get.mockResolvedValueOnce(guildRsses[0])

        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        await userRoute.routes.getMeGuilds(request, response)
        expect(response.statusCode).toEqual(200)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(expectedResponse)
      })
      it('returns only guilds that user has ADMINISTRATOR permissions in', async function () {
        const apiGuilds = [
          { id: '1wt', permissions: 0 },
          { id: '2sg', permissions: ADMINISTRATOR_PERMISSION }
        ]
        const guildRsses = [
          { foo: 'bar' },
          { foo: 'baz' }
        ]
        const expectedResponse = [
          {
            discord: apiGuilds[1],
            profile: guildRsses[1]
          }
        ]
        fetchUser.guilds.mockResolvedValueOnce(apiGuilds)
        redisOps.guilds.exists.mockResolvedValueOnce(1)
        redisOps.guilds.exists.mockResolvedValueOnce(1)

        dbOps.guildRss.get.mockResolvedValueOnce(guildRsses[1])

        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        await userRoute.routes.getMeGuilds(request, response)
        expect(response.statusCode).toEqual(200)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(expectedResponse)
      })
      it('returns only guilds that user is owner OR has ADMINISTRATOR/MANAGE_CHANNELS permissions in', async function () {
        const apiGuilds = [
          { id: '1wt' },
          { id: '2DFGsg', permissions: ADMINISTRATOR_PERMISSION | MANAGE_CHANNEL_PERMISSION },
          { id: '2DFsrgGsg', owner: true, permissions: ADMINISTRATOR_PERMISSION },
          { id: 'aw35r', owner: true, permissions: MANAGE_CHANNEL_PERMISSION },
          { id: 'aqwr3e52' }

        ]
        const guildRsses = [
          { foo: 'bar' },
          { foo: 'baz' },
          { as: 'here' },
          { world: 'war' },
          { john: 'doe' }
        ]
        const expectedResponse = [
          {
            discord: apiGuilds[1],
            profile: guildRsses[1]
          }, {
            discord: apiGuilds[2],
            profile: guildRsses[2]
          }, {
            discord: apiGuilds[3],
            profile: guildRsses[3]
          }
        ]
        fetchUser.guilds.mockResolvedValueOnce(apiGuilds)
        const mocked = redisOps.guilds.exists.mockResolvedValueOnce(1)
        for (let i = 1; i < apiGuilds.length; ++i) {
          mocked.mockResolvedValueOnce(1)
        }

        dbOps.guildRss.get.mockResolvedValueOnce(guildRsses[1])
        dbOps.guildRss.get.mockResolvedValueOnce(guildRsses[2])
        dbOps.guildRss.get.mockResolvedValueOnce(guildRsses[3])

        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        await userRoute.routes.getMeGuilds(request, response)
        expect(response.statusCode).toEqual(200)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(expectedResponse)
        // agent
        //   .get('/api/users/@me/guilds')
        //   .expect(200, response, function () {
        //     expect(redisOps.guilds.exists).toHaveBeenCalledTimes(5)
        //     expect(dbOps.guildRss.get).toHaveBeenCalledTimes(3)
        //     done()
        //   })
      })
    })
  })

  // describe('/users', function () {
  //   describe('GET /@me', function () {
  //     it('returns with redis response if user is cached', function (done) {
  //       const redisResponse = { username: '12325' }
  //       redisOps.users.get.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(userId)
  //         return redisResponse
  //       })
  //       agent
  //         .get('/api/users/@me')
  //         .expect(200, redisResponse, done)
  //     })
  //     it(`returns Discord API's response if user is not cached`, function (done) {
  //       redisOps.users.get.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(userId)
  //         return null
  //       })
  //       expect(redisOps.users.get).toBeCalled()
  //       const discordResponse = { foo: 'bar', dinkle: 'berry' }
  //       fetchUser.info.mockImplementationOnce(async (arg1, arg2) => {
  //         // expect(arg1).toEqual(userId)
  //         // expect(arg2).toEqual(accessToken)
  //         return discordResponse
  //       })
  //       agent
  //         .get('/api/users/@me')
  //         .expect(200, discordResponse, done)
  //     })
  //   })
  //   describe('GET /@bot', function () {
  //     it('returns the redis response if cached', function (done) {
  //       const redisResponse = { foo: 'baz' }
  //       redisOps.users.get.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(process.env.DRSS_CLIENT_ID)
  //         return redisResponse
  //       })
  //       agent
  //         .get('/api/users/@bot')
  //         .expect(200, redisResponse, done)
  //     })
  //     it('returns empty object if uncached', function (done) {
  //       redisOps.users.get.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(process.env.DRSS_CLIENT_ID)
  //         return null
  //       })
  //       agent
  //         .get('/api/users/@bot')
  //         .expect(200, {}, done)
  //     })
  //   })
  //   describe('GET /@me/guilds', function () {
  //     const MANAGE_CHANNEL_PERMISSION = 16
  //     const ADMINISTRATOR_PERMISSION = 8
  //     afterEach(function () {
  //       fetchUser.guilds.mockClear()
  //       redisOps.guilds.exists.mockClear()
  //       dbOps.guildRss.get.mockClear()
  //     })
  //     it('returns no guilds if no API guilds are in cache', function (done) {
  //       const apiGuilds = [
  //         { id: '1' }
  //       ]
  //       fetchUser.guilds.mockImplementationOnce(async (arg1, arg2) => {
  //         expect(arg1).toEqual(userId)
  //         expect(arg2).toEqual(accessToken)
  //         return apiGuilds
  //       })
  //       redisOps.guilds.exists.mockImplementationOnce(async arg => {
  //         expect(arg).toEqual(apiGuilds[0].id)
  //         return 0
  //       })

  //       agent
  //         .get('/api/users/@me/guilds')
  //         .expect(200, [], done)
  //     })
  //     it('returns only guilds that user is owner of', function (done) {
  //       const apiGuilds = [
  //         { id: '1', owner: true },
  //         { id: '2', owner: false }
  //       ]
  //       const guildRsses = [
  //         { foo: 'bar' },
  //         { foo: 'baz' }
  //       ]
  //       const response = [
  //         {
  //           discord: apiGuilds[0],
  //           profile: guildRsses[0]
  //         }
  //       ]
  //       fetchUser.guilds.mockImplementationOnce(async (arg1, arg2) => {
  //         // expect(arg1).toEqual(userId)
  //         // expect(arg2).toEqual(accessToken)
  //         return apiGuilds
  //       })
  //       redisOps.guilds.exists.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[0].id)
  //         return 1
  //       }).mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[1].id)
  //         return 1
  //       })

  //       dbOps.guildRss.get.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[0].id)
  //         return guildRsses[0]
  //       })

  //       agent
  //         .get('/api/users/@me/guilds')
  //         .expect(200, response, function () {
  //           expect(redisOps.guilds.exists).toHaveBeenCalledTimes(2)
  //           expect(dbOps.guildRss.get).toHaveBeenCalledTimes(1)
  //           done()
  //         })
  //     })
  //     it('returns only guilds that user has MANAGE_CHANNEL permissions in', function (done) {
  //       const apiGuilds = [
  //         { id: '2', permissions: MANAGE_CHANNEL_PERMISSION },
  //         { id: '1', permissions: 0 }
  //       ]
  //       const guildRsses = [
  //         { foo: 'bar' },
  //         { foo: 'baz' }
  //       ]
  //       const response = [
  //         {
  //           discord: apiGuilds[0],
  //           profile: guildRsses[0]
  //         }
  //       ]
  //       fetchUser.guilds.mockImplementationOnce(async (arg1, arg2) => {
  //         // expect(arg1).toEqual(userId)
  //         // expect(arg2).toEqual(accessToken)
  //         return apiGuilds
  //       })
  //       redisOps.guilds.exists.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[0].id)
  //         return 1
  //       }).mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[1].id)
  //         return 1
  //       })

  //       dbOps.guildRss.get.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[0].id)
  //         return guildRsses[0]
  //       })

  //       agent
  //         .get('/api/users/@me/guilds')
  //         .expect(200, response, function () {
  //           expect(redisOps.guilds.exists).toHaveBeenCalledTimes(2)
  //           expect(dbOps.guildRss.get).toHaveBeenCalledTimes(1)
  //           done()
  //         })
  //     })
  //     it('returns only guilds that user has ADMINISTRATOR permissions in', function (done) {
  //       const apiGuilds = [
  //         { id: '1wt', permissions: 0 },
  //         { id: '2sg', permissions: ADMINISTRATOR_PERMISSION }
  //       ]
  //       const guildRsses = [
  //         { foo: 'bar' },
  //         { foo: 'baz' }
  //       ]
  //       const response = [
  //         {
  //           discord: apiGuilds[1],
  //           profile: guildRsses[1]
  //         }
  //       ]
  //       fetchUser.guilds.mockImplementationOnce(async (arg1, arg2) => {
  //         // expect(arg1).toEqual(userId)
  //         // expect(arg2).toEqual(accessToken)
  //         return apiGuilds
  //       })
  //       redisOps.guilds.exists.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[0].id)
  //         return 1
  //       }).mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[1].id)
  //         return 1
  //       })

  //       dbOps.guildRss.get.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[1].id)
  //         return guildRsses[1]
  //       })

  //       agent
  //         .get('/api/users/@me/guilds')
  //         .expect(200, response, function () {
  //           expect(redisOps.guilds.exists).toHaveBeenCalledTimes(2)
  //           expect(dbOps.guildRss.get).toHaveBeenCalledTimes(1)
  //           done()
  //         })
  //     })
  //     it('returns only guilds that user is owner OR has ADMINISTRATOR/MANAGE_CHANNELS permissions in', function (done) {
  //       const apiGuilds = [
  //         { id: '1wt' },
  //         { id: '2DFGsg', permissions: ADMINISTRATOR_PERMISSION | MANAGE_CHANNEL_PERMISSION },
  //         { id: '2DFsrgGsg', owner: true, permissions: ADMINISTRATOR_PERMISSION },
  //         { id: 'aw35r', owner: true, permissions: MANAGE_CHANNEL_PERMISSION },
  //         { id: 'aqwr3e52' }

  //       ]
  //       const guildRsses = [
  //         { foo: 'bar' },
  //         { foo: 'baz' },
  //         { as: 'here' },
  //         { world: 'war' },
  //         { john: 'doe' }
  //       ]
  //       const response = [
  //         {
  //           discord: apiGuilds[1],
  //           profile: guildRsses[1]
  //         }, {
  //           discord: apiGuilds[2],
  //           profile: guildRsses[2]
  //         }, {
  //           discord: apiGuilds[3],
  //           profile: guildRsses[3]
  //         }
  //       ]
  //       fetchUser.guilds.mockImplementationOnce(async (arg1, arg2) => {
  //         // expect(arg1).toEqual(userId)
  //         // expect(arg2).toEqual(accessToken)
  //         return apiGuilds
  //       })
  //       const mocked = redisOps.guilds.exists.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[0].id)
  //         return 1
  //       })
  //       for (let i = 1; i < apiGuilds.length; ++i) {
  //         mocked.mockImplementationOnce(async arg => {
  //           // expect(arg).toEqual(apiGuilds[i].id)
  //           return 1
  //         })
  //       }

  //       dbOps.guildRss.get.mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[1].id)
  //         return guildRsses[1]
  //       }).mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[2].id)
  //         return guildRsses[2]
  //       }).mockImplementationOnce(async arg => {
  //         // expect(arg).toEqual(apiGuilds[3].id)
  //         return guildRsses[3]
  //       })

  //       agent
  //         .get('/api/users/@me/guilds')
  //         .expect(200, response, function () {
  //           expect(redisOps.guilds.exists).toHaveBeenCalledTimes(5)
  //           expect(dbOps.guildRss.get).toHaveBeenCalledTimes(3)
  //           done()
  //         })
  //     })
  //   })
  // })
})
