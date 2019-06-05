/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const httpMocks = require('node-mocks-http')
const apiRouter = require('../routes/api/index.js')
const statusCodes = require('../constants/codes.js')

jest.mock('../constants/codes.js')

describe('/api', function () {
  const userId = '62368028891823362391'
  const session = {
    identity: {
      id: userId
    },
    auth: {
      foo: 'bar'
    }
  }
  describe('GET /authenticated', function () {
    it('returns a JSON object with authenticated true if authenticated', function () {
      const request = httpMocks.createRequest({ session })
      const response = httpMocks.createResponse()
      apiRouter.routes.getAuthenticated(request, response)
      const data = JSON.parse(response._getData())
      expect(data).toEqual({ authenticated: true })
    })
    it('returns a JSON object with authenticated false if not authenticated', function () {
      const request = httpMocks.createRequest({ session: {} })
      const response = httpMocks.createResponse()
      apiRouter.routes.getAuthenticated(request, response)
      const data = JSON.parse(response._getData())
      expect(data).toEqual({ authenticated: false })
    })
  })
  describe('middleware', function () {
    describe('authenticate', function () {
      it('returns 401 if no auth credentials in session', function () {
        const request = httpMocks.createRequest({ session: {} })
        const response = httpMocks.createResponse()
        apiRouter.middleware.authenticate(request, response)
        expect(response.statusCode).toEqual(401)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(401)
      })
      it('checks if accessToken is expired', function () {
        const request = httpMocks.createRequest({ session: { identity: {}, auth: {} } })
        const response = httpMocks.createResponse()
        const expiredFunc = jest.fn(() => false)
        request.app = { get: () => ({ accessToken: { create: () => ({ expired: expiredFunc }) } }) }
        apiRouter.middleware.authenticate(request, response, () => {})
        expect(expiredFunc).toHaveBeenCalledTimes(1)
      })
      it('calls next if auth credentials are not expired', function (done) {
        const request = httpMocks.createRequest({ session })
        const response = httpMocks.createResponse()
        request.app = { get: () => ({ accessToken: { create: () => ({ expired: () => false }) } }) }
        apiRouter.middleware.authenticate(request, response, done)
      })
      it('calls refresh func if auth credentials are expired', function (done) {
        const request = httpMocks.createRequest({ session: { identity: {}, auth: {} } })
        const response = httpMocks.createResponse()
        const refreshFunc = jest.fn(async () => true)
        request.app = { get: () => ({ accessToken: { create: () => ({ expired: () => true, refresh: refreshFunc }) } }) }
        apiRouter.middleware.authenticate(request, response, () => {
          try {
            expect(refreshFunc).toHaveBeenCalledTimes(1)
            done()
          } catch (err) {
            done(err)
          }
        })
      })
      it('calls next after successfully refreshing token if auth credentials are expired', function (done) {
        const request = httpMocks.createRequest({ session: { identity: {}, auth: {} } })
        const response = httpMocks.createResponse()
        request.app = { get: () => ({ accessToken: { create: () => ({ expired: () => true, refresh: async () => ({ token: {} }) }) } }) }
        apiRouter.middleware.authenticate(request, response, () => {
          done()
        })
      })
      it('calls next after with err if token failed to refresh when auth credentials are expired', function (done) {
        const request = httpMocks.createRequest({ session: { identity: {}, auth: {} } })
        const response = httpMocks.createResponse()
        const error = new Error('asdef')
        const refreshFunc = jest.fn(async () => { throw error })
        request.app = { get: () => ({ accessToken: { create: () => ({ expired: () => true, refresh: refreshFunc }) } }) }
        apiRouter.middleware.authenticate(request, response, routeErr => {
          try {
            expect(routeErr).toEqual(error)
            done()
          } catch (err) {
            done(err)
          }
        })
      })
      it('modifies req.session.auth from the refresh function promise result', function (done) {
        const request = httpMocks.createRequest({ session: { identity: {}, auth: {} } })
        const response = httpMocks.createResponse()
        const newAuth = { token: { fiddly: 'dink' } }
        request.app = { get: () => ({ accessToken: { create: () => ({ expired: () => true, refresh: async () => newAuth }) } }) }
        apiRouter.middleware.authenticate(request, response, () => {
          try {
            expect(request.session.auth).toEqual(newAuth.token)
            done()
          } catch (err) {
            done(err)
          }
        })
      })
    })
    describe('mongooseResults', function () {
      it('returns 200 if no result for PATCH', function () {
        const request = httpMocks.createRequest({ method: 'PATCH' })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(200)
      })
      it('returns 200 if no result for POST', function () {
        const request = httpMocks.createRequest({ method: 'POST' })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(200)
      })
      it('returns 200 if no result for PUT', function () {
        const request = httpMocks.createRequest({ method: 'PUT' })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(200)
      })
      it('returns 500 is ok=0 for PATCH', function () {
        const result = { ok: 0, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'PATCH', patchResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(500)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(500)
      })
      it('returns 500 is ok=0 for POST', function () {
        const result = { ok: 0, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'POST', postResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(500)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(500)
      })
      it('returns 500 is ok=0 for PUT', function () {
        const result = { ok: 0, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'PUT', putResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(500)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(500)
      })
      it('returns 404 is n=0 for PATCH', function () {
        const result = { ok: 1, n: 0, upserted: true }
        const request = httpMocks.createRequest({ method: 'PATCH', patchResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
      })
      it('returns 404 is n=0 for POST', function () {
        const result = { ok: 1, n: 0, upserted: true }
        const request = httpMocks.createRequest({ method: 'POST', postResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
      })
      it('returns 404 is n=0 for PUT', function () {
        const result = { ok: 1, n: 0, upserted: true }
        const request = httpMocks.createRequest({ method: 'PUT', putResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
      })
      it('returns 201 is upserted=true for PATCH', function () {
        const result = { ok: 1, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'PATCH', patchResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(201)
      })
      it('returns 201 is upserted=true for POST', function () {
        const result = { ok: 1, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'POST', postResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(201)
      })
      it('returns 201 is upserted=true for PUT', function () {
        const result = { ok: 1, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'PUT', putResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(201)
      })
      it('returns the guildRss is upserted=true for PATCH', function () {
        const guildRss = { fo: 'dunk' }
        const result = { ok: 1, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'PATCH', patchResult: result, guildRss })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(guildRss)
      })
      it('returns the guildRss is upserted=true for POST', function () {
        const guildRss = { fo: 'dunk' }
        const result = { ok: 1, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'POST', postResult: result, guildRss })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(guildRss)
      })
      it('returns the guildRss is upserted=true for PUT', function () {
        const guildRss = { fo: 'dunk' }
        const result = { ok: 1, n: 1, upserted: true }
        const request = httpMocks.createRequest({ method: 'PUT', putResult: result, guildRss })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(guildRss)
      })
      it('returns 304 is nModified=0 for PATCH', function () {
        const result = { ok: 1, n: 1, upserted: false, nModified: 0 }
        const request = httpMocks.createRequest({ method: 'PATCH', patchResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(304)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(304)
      })
      it('returns 304 is nModified=0 for POST', function () {
        const result = { ok: 1, n: 1, upserted: false, nModified: 0 }
        const request = httpMocks.createRequest({ method: 'POST', postResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(304)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(304)
      })
      it('returns 304 is nModified=0 for PUT', function () {
        const result = { ok: 1, n: 1, upserted: false, nModified: 0 }
        const request = httpMocks.createRequest({ method: 'PUT', putResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(304)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(304)
      })
      it('returns 200 if no result for DELETE', function () {
        const request = httpMocks.createRequest({ method: 'DELETE' })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(200)
      })
      it('returns 500 if ok=0 for DELETE', function () {
        const result = { ok: 0, n: 1 }
        const request = httpMocks.createRequest({ method: 'DELETE', deleteResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(500)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(500)
      })
      it('returns 404 if n=0 for DELETE', function () {
        const result = { ok: 1, n: 0 }
        const request = httpMocks.createRequest({ method: 'DELETE', deleteResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
      })
      it('returns 304 if nModified=0 for DELETE', function () {
        const result = { ok: 1, n: 1, nModified: 0 }
        const request = httpMocks.createRequest({ method: 'DELETE', deleteResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(304)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(304)
      })
      it('returns 204 if result is proper for DELETE', function () {
        const result = { ok: 1, n: 1 }
        const request = httpMocks.createRequest({ method: 'DELETE', deleteResult: result })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        expect(response.statusCode).toEqual(204)
      })
      it('returns the guildRss if result is proper for PATCH', function () {
        const guildRss = { foo: 'bar' }
        const result = { ok: 1, n: 1, nModified: 1, upserted: false }
        const request = httpMocks.createRequest({ method: 'PATCH', patchResult: result, guildRss })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(guildRss)
      })
      it('returns the guildRss if result is proper for POST', function () {
        const guildRss = { foo: 'bar' }
        const result = { ok: 1, n: 1, nModified: 1, upserted: false }
        const request = httpMocks.createRequest({ method: 'POST', postResult: result, guildRss })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(guildRss)
      })
      it('returns the guildRss if result is proper for PUT', function () {
        const guildRss = { foo: 'bar' }
        const result = { ok: 1, n: 1, nModified: 1, upserted: false }
        const request = httpMocks.createRequest({ method: 'PUT', putResult: result, guildRss })
        const response = httpMocks.createResponse()
        apiRouter.middleware.mongooseResults(request, response)
        const data = JSON.parse(response._getData())
        expect(data).toEqual(guildRss)
      })
    })
    describe('errorHandler', function () {
      describe('when error.response exists', function () {
        it('returns the response status', function () {
          const error = new Error('foobar')
          error.response = { status: 123 }
          const response = httpMocks.createResponse()
          apiRouter.middleware.errorHandler(error, null, response)
          expect(response.statusCode).toEqual(error.response.status)
        })
        it('returns a body with discord=true', function () {
          const error = new Error('foobar')
          error.response = { status: 123, data: { message: 'aaa' } }
          const response = httpMocks.createResponse()
          apiRouter.middleware.errorHandler(error, null, response)
          const data = JSON.parse(response._getData())
          expect(data.discord).toEqual(true)
        })
        it('returns a body with response.data.message if it exists', function () {
          const error = new Error('foobar')
          error.response = { status: 123, data: { message: 'aaa' } }
          const response = httpMocks.createResponse()
          apiRouter.middleware.errorHandler(error, null, response)
          const data = JSON.parse(response._getData())
          expect(data.message).toEqual(error.response.data.message)
        })
        it('returns a body with the status code message if response.data.message does not exist', function () {
          const error = new Error('foobar')
          error.response = { status: 12356 }
          const original = statusCodes[error.response.status]
          statusCodes[error.response.status] = { message: 'foobar' }
          const response = httpMocks.createResponse()
          apiRouter.middleware.errorHandler(error, null, response)
          const data = JSON.parse(response._getData())
          expect(data.message).toEqual(statusCodes[error.response.status].message)
          statusCodes[error.response.status] = original
        })
        it('returns a body with the default status text if response.data.message does not exist and status code message does not exist', function () {
          const error = new Error('foobar')
          error.response = { status: 12356, statusText: 'gasssss' }
          const response = httpMocks.createResponse()
          apiRouter.middleware.errorHandler(error, null, response)
          const data = JSON.parse(response._getData())
          expect(data.message).toEqual(error.response.statusText)
        })
      })
      it('returns 403 if error is bad csrf', function () {
        const error = new Error('foobar')
        error.code = 'EBADCSRFTOKEN'
        const response = httpMocks.createResponse()
        apiRouter.middleware.errorHandler(error, null, response)
        expect(response.statusCode).toEqual(403)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(403)
        expect(data.message).toEqual('Bad CSRF Token')
      })
      it('returns 500 for unrecognized errors', function () {
        const error = new Error('fdgj;')
        const response = httpMocks.createResponse()
        apiRouter.middleware.errorHandler(error, null, response)
        expect(response.statusCode).toEqual(500)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(500)
      })
    })
  })
})
