/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const httpMocks = require('node-mocks-http')
const guildFeedMessageRoute = require('../routes/api/guilds.feeds.message.js')
const dbOps = require('../../util/dbOps.js')

jest.mock('../../util/dbOps.js')

describe('/api/guilds/:guildId/feeds/:feedId/message', function () {
  const userId = 'georgie'
  const session = {
    identity: {
      id: userId
    }
  }
  const params = {
    guildId: '9887'
  }
  describe('DELETE /', function () {
    afterEach(function () {
      dbOps.guildRss.update.mockReset()
    })
    it('returns 404 if there is no feed message', async function () {
      const request = httpMocks.createRequest({ session, params, method: 'DELETE', source: {} })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.deleteFeedMessage(request, response)
      expect(response.statusCode).toEqual(404)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(404)
      expect(data.message.includes('Unknown feed message')).toEqual(true)
    })
    it('deletes the feed message', async function (done) {
      const source = { message: 'praise the sun!' }
      const request = httpMocks.createRequest({ session, params, method: 'DELETE', source, guildRss: {} })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.deleteFeedMessage(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          expect(source.message).toEqual(undefined)
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
    it('calls guildRss.update', async function (done) {
      const source = { message: 'praise the sun!' }
      const request = httpMocks.createRequest({ session, params, method: 'DELETE', source, guildRss: {} })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.deleteFeedMessage(request, response, nextErr => {
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
  describe('PATCH /', function () {
    afterEach(function () {
      dbOps.guildRss.update.mockReset()
    })
    it('returns 400 if body contains invalid keys', async function () {
      const body = { foo: 'baz', ho: [], junk: null, baa: undefined, nu: 1, message: 'adsef' }
      const request = httpMocks.createRequest({ session, params, method: 'PATCH', body })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.patchFeedMessage(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      for (const key in body) {
        if (key === 'message') continue
        expect(data.message).toHaveProperty(key)
        expect(data.message[key].includes('Invalid')).toEqual(true)
      }
    })
    it('returns 400 if message in body is not a string', async function () {
      const body = { message: false }
      const request = httpMocks.createRequest({ session, params, method: 'PATCH', body })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.patchFeedMessage(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('message')
      expect(data.message.message.includes('string')).toEqual(true)
    })
    it('returns 400 if message in body is empty string', async function () {
      const body = { message: '' }
      const request = httpMocks.createRequest({ session, params, method: 'PATCH', body })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.patchFeedMessage(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('message')
      expect(data.message.message.includes('required')).toEqual(true)
    })
    it('returns 400 if message in body is exceeds 1000 characters', async function () {
      let message = ''
      while (message.length <= 1000) message += 'a'
      const body = { message }
      const request = httpMocks.createRequest({ session, params, method: 'PATCH', body })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.patchFeedMessage(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('message')
      expect(data.message.message.includes('1000 characters')).toEqual(true)
    })
    it('updates the message', async function (done) {
      const body = { message: 'afsdgbnre ghne nto t hn' }
      const source = { message: 'original' }
      const request = httpMocks.createRequest({ session, params, method: 'PATCH', body, source, guildRss: {} })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.patchFeedMessage(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          expect(source.message).toEqual(body.message)
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
    it('calls guildRss.update', async function (done) {
      const body = { message: 'afsdgbnre ghne nto t hn' }
      const source = { message: 'original' }
      const request = httpMocks.createRequest({ session, params, method: 'PATCH', body, source, guildRss: {} })
      const response = httpMocks.createResponse()
      await guildFeedMessageRoute.routes.patchFeedMessage(request, response, nextErr => {
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
