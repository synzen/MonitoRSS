/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const httpMocks = require('node-mocks-http')
const feedsRouter = require('../routes/api/feeds.js')
const FeedFetcher = require('../../util/FeedFetcher.js')
const Article = require('../../structs/Article.js')
const axios = require('axios')
const FeedParserError = require('../../structs/errors/FeedParserError.js')
const RequestError = require('../../structs/errors/RequestError.js')

jest.mock('../../util/FeedFetcher.js')
jest.mock('../../util/serverLimit.js')
jest.mock('../../structs/Article.js')
jest.mock('axios')

describe('/api/feeds', function () {
  const userId = '62368028891823362391'
  describe('middleware', function () {
    describe('validUrl', function () {
      it('returns 400 if no url in params', function () {
        const request = httpMocks.createRequest()
        const response = httpMocks.createResponse()
        feedsRouter.middleware.validUrl(request, response)
        expect(response.statusCode).toEqual(400)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(400)
        expect(data.message).toEqual('No url in param specified')
      })
      it('returns 403 if feed url includes feed43.com', function () {
        const request = httpMocks.createRequest({ params: { url: 'https://www.feed43.com/354er' } })
        const response = httpMocks.createResponse()
        feedsRouter.middleware.validUrl(request, response)
        expect(response.statusCode).toEqual(403)
        const data = JSON.parse(response._getData())
        expect(data.code).toEqual(403)
        expect(data.message).toEqual('feed43 feeds are forbidden')
      })
      it('calls next on valid url', function (done) {
        const request = httpMocks.createRequest({ params: { url: 'https://www.whaet.com/354er' } })
        const response = httpMocks.createResponse()
        feedsRouter.middleware.validUrl(request, response, function (err) {
          try {
            expect(err).toEqual(undefined)
            done()
          } catch (err) {
            done(err)
          }
        })
      })
    })
  })
  describe('GET /:url', function () {
    const session = {
      identity: {
        id: userId
      }
    }

    it('returns 500 if feed fetch fails with unrecognized error', async function () {
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      const error = new Error('some error message')
      FeedFetcher.fetchFeed.mockRejectedValueOnce(error)
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(500)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(500)
      expect(data.message).toEqual(error.message)
    })
    it('returns 400 if feed fetch fails with invalid feed', async function () {
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      const error = new FeedParserError(null, 'Invalid feed')
      FeedFetcher.fetchFeed.mockRejectedValueOnce(error)
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(40002)
      expect(data.message).toEqual(error.message)
    })
    it('returns 400 if feed fetch fails with request error', async function () {
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      const error = new RequestError(null, 'srgt red e ')
      FeedFetcher.fetchFeed.mockRejectedValueOnce(error)
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(500)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(50042)
      expect(data.message).toEqual(error.message)
    })
    it('returns empty placeholders object and the xml string if getArticles has no articles', async function () {
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      const xml = '123'
      FeedFetcher.fetchFeed.mockResolvedValueOnce({ articleList: [] })
      axios.get.mockImplementationOnce(() => Promise.resolve({ data: xml }))
      await feedsRouter.routes.getUrl(request, response)
      const data = JSON.parse(response._getData())
      expect(data).toEqual({ placeholders: [], xml })
    })
    it('returns all placeholders of an article', async function () {
      const xml = '12344tge3r45tgy'
      const articleList = [
        {
          title: 'ha',
          description: '234r',
          image1: 'aedfwsgrt'
        }, {
          title: 'sdxv',
          description: '23tgy5r43'
        }
      ]
      axios.get.mockImplementationOnce(() => Promise.resolve({ data: xml }))
      for (const article of articleList) {
        Article.mockImplementationOnce(function () {
          this.placeholders = Object.keys(article)
          this.raw = article
          for (let ph in article) this[ph] = article[ph]
        })
      }
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      FeedFetcher.fetchFeed.mockResolvedValueOnce({ articleList })
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data.placeholders).toEqual(articleList)
    })
    it('returns the xml', async function () {
      const xml = '12344tge3r45tgy'
      const articleList = [
        {
          title: 'ha',
          description: '234r',
          image1: 'aedfwsgrt'
        }, {
          title: 'sdxv',
          description: '23tgy5r43'
        }
      ]
      axios.get.mockImplementationOnce(() => Promise.resolve({ data: xml }))
      for (const article of articleList) {
        Article.mockImplementationOnce(function () {
          this.placeholders = Object.keys(article)
          for (let ph in article) this[ph] = article[ph]
        })
      }
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      FeedFetcher.fetchFeed.mockResolvedValueOnce({ articleList })
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data.xml).toEqual(xml)
    })
    it('returns 500 if axios fails to get', async function () {
      const error = new Error('aswfieht2')
      const articleList = [
        {
          title: 'ha',
          description: '234r',
          image1: 'aedfwsgrt'
        }, {
          title: 'sdxv',
          description: '23tgy5r43'
        }
      ]
      axios.get.mockImplementationOnce(() => Promise.reject(error))
      for (const article of articleList) {
        Article.mockImplementationOnce(function () {
          this.placeholders = Object.keys(article)
          for (let ph in article) this[ph] = article[ph]
        })
      }
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      FeedFetcher.fetchFeed.mockResolvedValueOnce({ articleList })
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(500)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(500)
      expect(data.message).toEqual(error.message)
    })
  })
})
