/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const httpMocks = require('node-mocks-http')
const subscriberFilters = require('../routes/api/guilds.feeds.subscribers.filters.js')

describe('/api/guilds/:guildID/feeds', function () {
  const userID = 'georgie'
  const session = {
    identity: {
      id: userID
    }
  }
  const params = {
    guildID: '9887',
    subscriberID: 'q23t59w9oju'
  }
  describe('middleware validSubscriber', function () {
    it('returns 404 if subscriber is not found', async function () {
      const source = { random: 'key', subscribers: [{ id: params.subscriberID + 1 }] }
      const request = httpMocks.createRequest({ session, params, source, guildRss: {} })
      const response = httpMocks.createResponse()
      await subscriberFilters.middleware.validSubscriber(request, response)
      expect(response.statusCode).toEqual(404)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(404)
      expect(data.message).toEqual('Unknown Subscriber')
    })
    it('calls next() if subscriber is found in subscribers', async function (done) {
      const source = { subscribers: [{ id: params.subscriberID }] }
      const request = httpMocks.createRequest({ session, params, source, guildRss: {} })
      const response = httpMocks.createResponse()
      await subscriberFilters.middleware.validSubscriber(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
    it('defines req.subscriber if subscriber is found in subscribers', async function (done) {
      const source = { subscribers: [{ id: params.subscriberID }] }
      const request = httpMocks.createRequest({ session, params, source, guildRss: {} })
      const response = httpMocks.createResponse()
      await subscriberFilters.middleware.validSubscriber(request, response, nextErr => {
        if (nextErr) return done(nextErr)
        try {
          expect(request.subscriber).toBeDefined()
          done()
        } catch (err) {
          done(err)
        }
      })
      expect(response.statusCode).toEqual(200)
    })
  })
})
