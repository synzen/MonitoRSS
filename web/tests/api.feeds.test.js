/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const httpMocks = require('node-mocks-http')
const feedsRouter = require('../routes/api/feeds.js')
const getArticles = require('../../rss/getArticle.js')
const Article = require('../../structs/Article.js')
// config.feeds.max = 1000

jest.mock('../../util/dbOps.js')
jest.mock('../../util/redisOps.js')
jest.mock('../../util/serverLimit.js')
jest.mock('../util/fetchUser.js')
jest.mock('../../rss/getArticle.js')
jest.mock('../../structs/Article.js')

describe('/api/feeds', function () {
  const userId = '62368028891823362391'
  describe('GET /:url', function () {
    const session = {
      identity: {
        id: userId
      }
    }
    it('returns 400 if no url in params', async function () {
      const request = httpMocks.createRequest({ session })
      const response = httpMocks.createResponse()
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(400)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(400)
      expect(data.message).toEqual('No url in param specified')
    })
    it('returns 403 if feed url includes feed43.com', async function () {
      const request = httpMocks.createRequest({ session, params: { url: 'https://www.feed43.com/354er' } })
      const response = httpMocks.createResponse()
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(403)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(403)
      expect(data.message).toEqual('feed43 feeds are forbidden')
    })
    it('returns 500 if getArticles fails', async function () {
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      const error = new Error('some error message')
      getArticles.mockRejectedValueOnce(error)
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(500)
      const data = JSON.parse(response._getData())
      expect(data.code).toEqual(500)
      expect(data.message).toEqual(error.message)
    })
    it('returns all placeholders of an article', async function () {
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
      for (const article of articleList) {
        Article.mockImplementationOnce(function () {
          this.placeholders = Object.keys(article)
          for (let ph in article) this[ph] = article[ph]
        })
      }
      const request = httpMocks.createRequest({ session, params: { url: 'ads' } })
      const response = httpMocks.createResponse()
      getArticles.mockResolvedValueOnce([null, null, articleList])
      await feedsRouter.routes.getUrl(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(articleList)
    })
  })
})
