/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const httpMocks = require('node-mocks-http')
const guildFeedEmbedRoute = require('../routes/api/guilds.feeds.embeds.js')
const dbOps = require('../../util/dbOps.js')

jest.mock('../../util/dbOps.js')

describe('/api/guilds/:guildId/feeds/:feedId/embeds', function () {
  const userId = 'georgie'
  const session = {
    identity: {
      id: userId
    }
  }
  describe('middleware', function () {
    describe('idChecker', function () {
      it('returns 400 if embedId is NaN', function () {
        const params = { embedId: 'joey' }
        const request = httpMocks.createRequest({ session, params, source: {} })
        const response = httpMocks.createResponse()
        guildFeedEmbedRoute.middleware.idChecker(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
      })
      it('returns 400 if embedId is not an integer', function () {
        const params = { embedId: 1.23 }
        const request = httpMocks.createRequest({ session, params, source: {} })
        const response = httpMocks.createResponse()
        guildFeedEmbedRoute.middleware.idChecker(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
      })
      it('returns 400 if embedId is less than 0', function () {
        const params = { embedId: -1 }
        const request = httpMocks.createRequest({ session, params, source: {} })
        const response = httpMocks.createResponse()
        guildFeedEmbedRoute.middleware.idChecker(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
      })
      it('returns 400 if embedId is greater than 8', function () {
        const params = { embedId: 9 }
        const request = httpMocks.createRequest({ session, params, source: {} })
        const response = httpMocks.createResponse()
        guildFeedEmbedRoute.middleware.idChecker(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
      })
      it('calls next() if embedId is integer >= 0 and <= 8', function (done) {
        const params = { embedId: 8 }
        const request = httpMocks.createRequest({ session, params, source: {} })
        const response = httpMocks.createResponse()
        guildFeedEmbedRoute.middleware.idChecker(request, response, nextErr => {
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
    describe('embedExists', function () {
      it('returns 404 if no embeds key exists in source', function () {
        const source = {}
        const request = httpMocks.createRequest({ session, source })
        const response = httpMocks.createResponse()
        guildFeedEmbedRoute.middleware.embedExists(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
        expect(data.message).toEqual('Unknown embed')
      })
      it('returns 404 if no item exists in index of source embeds', function () {
        const source = { embeds: [] }
        const params = { embedId: 0 }
        const request = httpMocks.createRequest({ session, source, params })
        const response = httpMocks.createResponse()
        guildFeedEmbedRoute.middleware.embedExists(request, response)
        expect(response.statusCode).toEqual(404)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(404)
        expect(data.message).toEqual('Unknown embed')
      })
      it('calls next() if item exists in index of source embeds', function (done) {
        const source = { embeds: [{}, {}, {}, {}] }
        const params = { embedId: 3 }
        const request = httpMocks.createRequest({ session, source, params })
        const response = httpMocks.createResponse()
        guildFeedEmbedRoute.middleware.embedExists(request, response, nextErr => {
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
  })
  describe('DELETE /:embedId', function () {
    afterEach(function () {
      dbOps.guildRss.update.mockReset()
    })
    it('removes the embed from array', async function (done) {
      const source = { embeds: [{ a: 'b' }, { c: 'd' }, { e: 'f' }] }
      const params = { embedId: 1 }
      const expectedSource = { embeds: [{ a: 'b' }, { e: 'f' }] }
      const request = httpMocks.createRequest({ session, source, params })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.deleteEmbed(request, response, nextErr => {
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
      const source = { embeds: [{ a: 'b' }, { c: 'd' }, { e: 'f' }] }
      const params = { embedId: 1 }
      const request = httpMocks.createRequest({ session, source, params })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.deleteEmbed(request, response, nextErr => {
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
  describe('PATCH /:embedId', function () {
    afterEach(function () {
      dbOps.guildRss.update.mockReset()
    })
    it('returns 400 if id is out of bounds', async function () {
      const source = { embeds: [{}, {}] }
      const params = { embedId: 3 }
      const request = httpMocks.createRequest({ session, source, params })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message.includes('out of bounds')).toEqual(true)
    })
    it('returns 400 if body is empty', async function () {
      const source = { embeds: [{}, {}] }
      const params = { embedId: 1 }
      const request = httpMocks.createRequest({ session, source, params })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message.includes('body')).toEqual(true)
    })
    it('returns 403 if there is no webhook and the embedId is not 0', async function () {
      const source = { embeds: [{}, {}] }
      const params = { embedId: 1 }
      const body = { title: 'dsf' }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response)
      expect(response.statusCode).toEqual(403)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(403)
      expect(data.message.includes('webhook')).toEqual(true)
    })
    it('returns 400 on invalid body keys', async function () {
      const source = { embeds: [] }
      const params = { embedId: 0 }
      const body = { invalid1: 'dsf', invalid2: 'd', invalid3: 1, invalid4: null }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      for (const key in body) {
        expect(data.message).toHaveProperty(key)
        expect(data.message[key]).toEqual('Invalid setting')
      }
    })
    it('returns 400 on non-empty-string and non-number color', async function () {
      const source = { embeds: [] }
      const params = { embedId: 0 }
      const body = { color: 'fhbnio', title: 'gsdg' }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data).toEqual({ code: 400, message: { color: 'Must be a number' } })
    })
    it('returns 400 on non-empty-string and non-"article" and non-"now" timestamp', async function () {
      const source = { embeds: [] }
      const params = { embedId: 0 }
      const body = { timestamp: 'fhbnio', title: 'gsdg' }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toHaveProperty('timestamp')
    })
    it('returns 400 on keys with required string values but with no string value', async function () {
      const source = { embeds: [] }
      const params = { embedId: 0 }
      const body = { }
      for (const key in guildFeedEmbedRoute.constants.VALID_EMBED_KEYS_LENGTHS) {
        if (guildFeedEmbedRoute.constants.NON_STRING_KEYS.includes(key)) continue
        body[key] = 1
      }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      for (const key in body) {
        expect(data.message).toHaveProperty(key)
        expect(data.message[key]).toEqual('Must be a string')
      }
    })
    it('returns 400 on keys that exceeds their max lengths', async function () {
      const source = { embeds: [] }
      const params = { embedId: 0 }
      const body = { }
      for (const key in guildFeedEmbedRoute.constants.VALID_EMBED_KEYS_LENGTHS) {
        const len = guildFeedEmbedRoute.constants.VALID_EMBED_KEYS_LENGTHS[key]
        if (len === -1) continue
        let val = ''
        while (val.length < len) val += 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        body[key] = val
      }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      for (const key in body) {
        expect(data.message).toHaveProperty(key)
        expect(data.message[key].includes('Exceeds character limit')).toEqual(true)
      }
    })
    it('allows all keys to have empty strings', async function (done) {
      const source = { embeds: [] }
      const params = { embedId: 0 }
      const body = { }
      for (const key in guildFeedEmbedRoute.constants.VALID_EMBED_KEYS_LENGTHS) {
        body[key] = ''
      }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
    it('removes the specified embed from source if all keys are strings with no webhook', async function (done) {
      const source = { embeds: [{ title: 'zzz' }, { title: 'ha' }, { description: 'ho', footerText: 'sg' }] }
      const params = { embedId: 0 }
      const expectedSource = { embeds: [{ title: 'ha' }, { description: 'ho', footerText: 'sg' }] }
      const body = { }
      for (const key in guildFeedEmbedRoute.constants.VALID_EMBED_KEYS_LENGTHS) {
        body[key] = ''
      }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response, nextErr => {
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
    it('removes the specified embed from source if all keys are strings with webhook', async function (done) {
      const source = { embeds: [{ title: 'zzz' }, { title: 'ha' }, { description: 'ho', footerText: 'sg' }], webhook: { id: 123 } }
      const params = { embedId: 1 }
      const expectedSource = { embeds: [{ title: 'zzz' }, { description: 'ho', footerText: 'sg' }], webhook: { id: 123 } }
      const body = { }
      for (const key in guildFeedEmbedRoute.constants.VALID_EMBED_KEYS_LENGTHS) {
        body[key] = ''
      }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response, nextErr => {
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
    it('adds the specified embed from source if embeds do not exist already with no webhook', async function (done) {
      const source = { }
      const params = { embedId: 0 }
      const body = { title: 'hzzzz' }
      const expectedSource = { embeds: [ body ] }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response, nextErr => {
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
    it('adds the specified embed from source if embeds do not exist with webhook', async function (done) {
      const source = { webhook: { id: '123' } }
      const params = { embedId: 0 }
      const body = { title: 'hzzzz' }
      const expectedSource = { embeds: [ body ], ...source }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response, nextErr => {
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
    it('adds the specified embed from source if other embeds do exist with webhook', async function (done) {
      const source = { webhook: { id: '123' }, embeds: [{ title: 'edf' }, { description: 'sgwe' }] }
      const params = { embedId: 2 }
      const body = { title: 'hzzzz' }
      const expectedSource = { embeds: [ ...source.embeds, body ], webhook: { ...source.webhook } }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response, nextErr => {
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
    it('edits the specified embed that exists in source with no webhook', async function (done) {
      const source = { embeds: [{ title: 'edf' }] }
      const params = { embedId: 0 }
      const body = { title: 'hzzzz' }
      const expectedSource = { embeds: [ body ] }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response, nextErr => {
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
    it('edits the specified embed that exists in source with keys with webhook', async function (done) {
      const source = { embeds: [{ title: 'edf' }, { description: 'fallout' }], webhook: { id: '123' } }
      const params = { embedId: 1 }
      const body = { title: 'hzzzz' }
      const expectedSource = { embeds: [ source.embeds[0], { ...source.embeds[params.embedId], ...body } ], webhook: { ...source.webhook } }
      const request = httpMocks.createRequest({ session, source, params, body })
      const response = httpMocks.createResponse()
      await guildFeedEmbedRoute.routes.patchEmbed(request, response, nextErr => {
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
    describe('with embed fields', function () {
      const source = { embeds: [] }
      const params = { embedId: 0 }
      it('returns 400 on non-array fields key', async function () {
        const body = { fields: 1, title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toEqual({ fields: 'Must be an array' })
      })
      it('returns 400 on empty array in fields key', async function () {
        const body = { fields: [], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toEqual({ fields: 'Must be populated if array' })
      })
      it('returns 400 if array in fields key contains null', async function () {
        const body = { fields: [null, null], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
      })
      it('returns 400 if array in fields key contains boolean', async function () {
        const body = { fields: [true, false], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
      })
      it('returns 400 if array in fields key contains strings', async function () {
        const body = { fields: ['a', 'b'], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
      })
      it('returns 400 if array in fields key contains undefined', async function () {
        const body = { fields: [undefined, undefined], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
      })
      it('returns 400 if array in fields key contains objects with fields other than "title", "value" and "inline"', async function () {
        const body = { fields: [{ title: 'das', value: 'swgr' }, { title: 's', value: 'sdfbh', foo: 'bar' }, { title: 'sdg', value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('Invalid setting')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with "title" being non-string', async function () {
        const body = { fields: [{ title: 'das', value: 'swgr' }, { title: 243, value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('Invalid type')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with "value" being non-string', async function () {
        const body = { fields: [{ title: 'das', value: true }, { title: 'wsdeg', value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('Invalid type')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with "title" and "value" being non-string', async function () {
        const body = { fields: [{ title: 123, value: [] }, { title: 'wsdeg', value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('Invalid type')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with empty "title"', async function () {
        const body = { fields: [{ title: 'das', value: 'dfg' }, { title: '', value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('are required')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with empty "value"', async function () {
        const body = { fields: [{ title: 'das', value: '' }, { title: 'sdg', value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('are required')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with empty "title" and "value"', async function () {
        const body = { fields: [{ title: '', value: '' }, { title: 'sdg', value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('are required')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with non-boolean "inline"', async function () {
        const body = { fields: [{ title: 'ghm', value: 'edrhttrh' }, { title: 'sdg', value: 'sewg', inline: [] }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('Invalid type')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with "title" that exceeds character limit', async function () {
        let fieldTitle = ''
        const maxLen = guildFeedEmbedRoute.constants.VALID_FIELD_KEYS.title.maxLength
        while (fieldTitle.length < maxLen) fieldTitle += 'aeo[tgujwpoljgmhperoihjubpij'
        const body = { fields: [{ title: fieldTitle, value: 'edrhttrh' }, { title: 'sdg', value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('exceeds character limit')).toEqual(true)
      })
      it('returns 400 if array in fields key contains objects with "value" that exceeds character limit', async function () {
        let fieldValue = ''
        const maxLen = guildFeedEmbedRoute.constants.VALID_FIELD_KEYS.value.maxLength
        while (fieldValue.length < maxLen) fieldValue += 'aeo[tgujwpoljgmhperoihjubpij'
        const body = { fields: [{ title: 'rege', value: fieldValue }, { title: 'sdg', value: 'sewg' }], title: 'g' }
        const request = httpMocks.createRequest({ session, source, params, body })
        const response = httpMocks.createResponse()
        await guildFeedEmbedRoute.routes.patchEmbed(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toHaveProperty('fields')
        expect(data.message.fields.includes('exceeds character limit')).toEqual(true)
      })
    })
  })
  // describe('DELETE /', function () {
  //   afterEach(function () {
  //     dbOps.guildRss.update.mockReset()
  //   })
  //   it('returns 404 if there is no feed message', async function () {
  //     const request = httpMocks.createRequest({ session, params, method: 'DELETE', source: {} })
  //     const response = httpMocks.createResponse()
  //     await guildFeedMessageRoute.routes.deleteFeedMessage(request, response)
  //     expect(response.statusCode).toEqual(404)
  //     const data = JSON.parse(response._getData())
  //     expect(data.code).toEqual(404)
  //     expect(data.message.includes('Unknown feed message')).toEqual(true)
  //   })
  //   it('deletes the feed message', async function (done) {
  //     const source = { message: 'praise the sun!' }
  //     const request = httpMocks.createRequest({ session, params, method: 'DELETE', source, guildRss: {} })
  //     const response = httpMocks.createResponse()
  //     await guildFeedMessageRoute.routes.deleteFeedMessage(request, response, nextErr => {
  //       if (nextErr) return done(nextErr)
  //       try {
  //         expect(source.message).toEqual(undefined)
  //         done()
  //       } catch (err) {
  //         done(err)
  //       }
  //     })
  //     expect(response.statusCode).toEqual(200)
  //   })
  //   it('calls guildRss.update', async function (done) {
  //     const source = { message: 'praise the sun!' }
  //     const request = httpMocks.createRequest({ session, params, method: 'DELETE', source, guildRss: {} })
  //     const response = httpMocks.createResponse()
  //     await guildFeedMessageRoute.routes.deleteFeedMessage(request, response, nextErr => {
  //       if (nextErr) return done(nextErr)
  //       try {
  //         expect(dbOps.guildRss.update).toHaveBeenCalledTimes(1)
  //         done()
  //       } catch (err) {
  //         done(err)
  //       }
  //     })
  //     expect(response.statusCode).toEqual(200)
  //   })
  // })
})
