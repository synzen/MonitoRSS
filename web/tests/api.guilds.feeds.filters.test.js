/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const httpMocks = require('node-mocks-http')
const guildFeedFiltersRoute = require('../routes/api/guilds.feeds.filters.js')
const dbOps = require('../../util/dbOps.js')

jest.mock('../../util/dbOps.js')

describe('/api/guilds/:guildId/feeds/:feedId/filters', function () {
  const userId = 'georgie'
  const session = {
    identity: {
      id: userId
    }
  }
  const params = {
    guildId: '9887'
  }
  describe('middleware validBody', function () {
    it('returns 400 if body contains invalid keys', function () {
      const body = { a: '', b: null, c: undefined }
      const request = httpMocks.createRequest({ session, params, body })
      const response = httpMocks.createResponse()
      guildFeedFiltersRoute.middleware.validBody(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      for (const key in body) {
        expect(data.message).toHaveProperty(key)
        expect(data.message[key].includes('Invalid')).toEqual(true)
      }
    })
    it('returns 400 if valid keys in body are not strings', function () {
      const body = { type: false, term: null }
      const request = httpMocks.createRequest({ session, params, body })
      const response = httpMocks.createResponse()
      guildFeedFiltersRoute.middleware.validBody(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      for (const key in body) {
        expect(data.message).toHaveProperty(key)
        expect(data.message[key].includes('string')).toEqual(true)
      }
    })
    it('returns 400 if some keys are invalid and valid keys are incorrect types', function () {
      const body = { type: 'cxf', term: null, invalidKey: 123 }
      const request = httpMocks.createRequest({ session, params, body })
      const response = httpMocks.createResponse()
      guildFeedFiltersRoute.middleware.validBody(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('term')
      expect(data.message.term.includes('string')).toEqual(true)
      expect(data.message).toHaveProperty('invalidKey')
      expect(data.message.invalidKey.includes('Invalid')).toEqual(true)
    })
    it('returns 400 if valid keys are empty strings', function () {
      const body = { type: '', term: '' }
      const request = httpMocks.createRequest({ session, params, body })
      const response = httpMocks.createResponse()
      guildFeedFiltersRoute.middleware.validBody(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      for (const key in body) {
        expect(data.message).toHaveProperty(key)
        expect(data.message[key].includes('populated')).toEqual(true)
      }
    })
    it('returns 400 if term or type exceeds 1000 characters', function () {
      let str = ''
      while (str.length <= 1000) {
        str += 'a'
      }
      const body = { type: str, term: str }
      const request = httpMocks.createRequest({ session, params, body })
      const response = httpMocks.createResponse()
      guildFeedFiltersRoute.middleware.validBody(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      for (const key in body) {
        expect(data.message).toHaveProperty(key)
        expect(data.message[key]).toEqual('Must be fewer than 1000 characters')
      }
    })
  })
  describe('DELETE /', function () {
    afterEach(function () {
      dbOps.guildRss.update.mockReset()
    })
    it('returns 404 if source has no filters', async function () {
      const request = httpMocks.createRequest({ session, params, source: {}, method: 'DELETE' })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.deleteFeedFilters(request, response)
      expect(response.statusCode).toEqual(404)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(404)
      expect(data.message.includes('Unknown filters')).toEqual(true)
    })
    it('returns 404 if filter term was not found', async function () {
      const source = {
        filters: {
          key: ['val']
        }
      }
      const body = {
        type: 'key',
        term: 'random-invalid'
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'DELETE', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.deleteFeedFilters(request, response)
      expect(response.statusCode).toEqual(404)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(404)
      expect(data.message).toEqual('Unknown filter')
    })
    it('deletes all filters if type and term is *', async function (done) {
      const source = {
        filters: {
          key: ['val'],
          ho: ['asdg', 'das'],
          azsvfd: ['resdhy', 'jock']
        }
      }
      const body = {
        type: '*',
        term: '*'
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'DELETE', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.deleteFeedFilters(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          expect(source.filters).toEqual(undefined)
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
    it('deletes the specified filter', async function (done) {
      const source = {
        filters: {
          key: ['val'],
          ho: ['asdg', 'das'],
          azsvfd: ['resdhy', 'jock']
        }
      }
      const body = {
        type: 'ho',
        term: 'das'
      }
      const expectedSource = {
        filters: {
          key: ['val'],
          ho: ['asdg'],
          azsvfd: ['resdhy', 'jock']
        }
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'DELETE', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.deleteFeedFilters(request, response, nextErr => {
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
    it('removes the filters object if it is empty after changes', async function (done) {
      const source = {
        filters: {
          key: ['val']
        }
      }
      const body = {
        type: 'key',
        term: 'val'
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'DELETE', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.deleteFeedFilters(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          expect(source.filters).toEqual(undefined)
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
    it('removes the filter type array if it is empty after changes', async function (done) {
      const source = {
        filters: {
          key: ['val'],
          other: ['kudos']
        }
      }
      const body = {
        type: 'key',
        term: 'val'
      }
      const expectedSource = {
        filters: {
          other: ['kudos']
        }
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'DELETE', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.deleteFeedFilters(request, response, nextErr => {
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
      const source = {
        filters: {
          key: ['val'],
          ho: ['asdg', 'das'],
          azsvfd: ['resdhy', 'jock']
        }
      }
      const body = {
        type: '*',
        term: '*'
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'DELETE', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.deleteFeedFilters(request, response, nextErr => {
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
  describe('PUT /', function () {
    afterEach(function () {
      dbOps.guildRss.update.mockReset()
    })
    it('returns 409 if term already exists', async function () {
      const source = {
        filters: {
          key: ['val'],
          ho: ['asdg', 'das'],
          azsvfd: ['resdhy', 'jock']
        }
      }
      const body = {
        type: 'ho',
        term: 'das'
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'PUT', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.putFeedFilters(request, response)
      expect(response.statusCode).toEqual(409)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(409)
      expect(data.message.includes('Already exists')).toEqual(true)
    })
    it('adds the term in an array that already exists', async function (done) {
      const source = {
        filters: {
          ho: ['asdg']
        }
      }
      const body = {
        type: 'ho',
        term: 'das'
      }
      const expectedSource = {
        filters: {
          ho: ['asdg', 'das']
        }
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'PUT', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.putFeedFilters(request, response, nextErr => {
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
    it('adds the term in an array that does not exist but other filters exist', async function (done) {
      const source = {
        filters: {
          ho: ['asdg']
        }
      }
      const body = {
        type: 'ho',
        term: 'das'
      }
      const expectedSource = {
        filters: {
          ho: ['asdg', 'das']
        }
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'PUT', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.putFeedFilters(request, response, nextErr => {
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
    it('adds the term in an array that does not exist but other filters exist', async function (done) {
      const source = {
        filters: {
          ja: ['2346']
        }
      }
      const body = {
        type: 'ho',
        term: 'das'
      }
      const expectedSource = {
        filters: {
          ho: ['das'],
          ja: ['2346']
        }
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'PUT', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.putFeedFilters(request, response, nextErr => {
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
    it('adds the term when no filters exist', async function (done) {
      const source = {
      }
      const body = {
        type: 'ho',
        term: 'das'
      }
      const expectedSource = {
        filters: {
          ho: ['das']
        }
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'PUT', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.putFeedFilters(request, response, nextErr => {
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
    it('adds the term when there is an empty filters object', async function (done) {
      const source = {
        filters: {}
      }
      const body = {
        type: 'ho',
        term: 'das'
      }
      const expectedSource = {
        filters: {
          ho: ['das']
        }
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'PUT', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.putFeedFilters(request, response, nextErr => {
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
      const source = {
        filters: {
          ho: ['asd']
        }
      }
      const body = {
        type: 'ho',
        term: 'das'
      }
      const request = httpMocks.createRequest({ session, params, source, method: 'PUT', body })
      const response = httpMocks.createResponse()
      await guildFeedFiltersRoute.routes.putFeedFilters(request, response, nextErr => {
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
