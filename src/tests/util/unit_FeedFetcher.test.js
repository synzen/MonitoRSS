const FeedFetcher = require('../../util/FeedFetcher.js')
const fetch = require('node-fetch')
// const DecodedFeedParser = require('../../structs/DecodedFeedParser.js')
// const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')
const Article = require('../../structs/Article.js')
const RequestError = require('../../structs/errors/RequestError.js')
const cloudscraper = require('cloudscraper')
const config = require('../../config.js')
const Readable = require('stream').Readable

jest.mock('node-fetch')
jest.mock('cloudscraper')
jest.mock('../../config.js')
jest.mock('../../structs/ArticleIDResolver.js')
jest.mock('../../structs/Article.js')
jest.mock('../../structs/DecodedFeedParser.js')

describe('Unit::FeedFetcher', function () {
  afterEach(function () {
    jest.restoreAllMocks()
    fetch.mockReset()
    config._vip = false
  })
  it('throws an error if it is instantiated', function () {
    expect(() => new FeedFetcher()).toThrowError()
  })
  describe('fetchURL', function () {
    describe('retried is false', function () {
      it('throws an error if url is not defined', function () {
        return expect(FeedFetcher.fetchURL()).rejects.toBeInstanceOf(Error)
      })
      it('passes the shallow request options to fetch', async function () {
        const reqOpts = { a: 'b', c: 'd', e: 'f' }
        fetch.mockResolvedValueOnce({ status: 200 })
        await FeedFetcher.fetchURL('abc', reqOpts)
        const passedObject = fetch.mock.calls[0][1]
        for (const key in reqOpts) {
          expect(passedObject[key]).toEqual(reqOpts[key])
        }
      })
      it('passes the options.headers to fetch', async function () {
        const reqOpts = { headers: { a: 'b', c: 'd' } }
        fetch.mockResolvedValueOnce({ status: 200 })
        await FeedFetcher.fetchURL('abc', reqOpts)
        const passedObject = fetch.mock.calls[0][1]
        for (const key in reqOpts.headers) {
          expect(passedObject.headers[key]).toEqual(reqOpts.headers[key])
        }
      })
      it('does no recursive call if fetch failed and retried is true', function (done) {
        FeedFetcher.fetchURL('abc', {}, true)
          .then(() => done(new Error('Promise resolved')))
          .catch(() => {
            expect(fetch).toHaveBeenCalledTimes(1)
            done()
          })
          .catch(done)
      })
      it('throws a RequestError if fetch throws an error', function (done) {
        fetch.mockRejectedValueOnce(new Error('abc'))
        FeedFetcher.fetchURL('abc')
          .then(() => done(new Error('Promise resolved')))
          .catch(err => {
            expect(err).toBeInstanceOf(RequestError)
            done()
          })
          .catch(done)
      })
      it('returns the stream and response if the response status is 200', async function () {
        const body = 'abc'
        const response = { body, status: 200 }
        fetch.mockResolvedValueOnce(response)
        const data = await FeedFetcher.fetchURL('abc')
        expect(data).toEqual({ stream: body, response })
      })
      it('returns the stream and response if the response status is 304 with If-Modified-Since and If-None-Match is in request headers', async function () {
        const headers = { 'If-Modified-Since': 1, 'If-None-Match': 1 }
        const body = 'abc'
        const response = { body, status: 304 }
        fetch.mockResolvedValueOnce(response)
        const data = await FeedFetcher.fetchURL('abc', { headers })
        expect(data).toEqual({ stream: body, response })
      })
      it('recursively calls again if res status is 403/400', async function () {
        fetch
          .mockResolvedValueOnce({ status: 403 })
          .mockResolvedValueOnce({ status: 200 })
        const spy = jest.spyOn(FeedFetcher, 'fetchURL')
        await FeedFetcher.fetchURL('abc')
        expect(spy).toHaveBeenCalledTimes(2)
      })
      it('recursively calls with empty user agent if res status is 403/400', async function () {
        const headers = { a: 'b', c: 'd' }
        fetch
          .mockResolvedValueOnce({ status: 403 })
          .mockResolvedValueOnce({ status: 200 })
        await FeedFetcher.fetchURL('abc', { headers })
        expect(fetch.mock.calls[1][1].headers['user-agent']).toEqual('')
      })
    })
    describe('request failed and retried is true', function () {
      it('throws a RequestError if res headers does not include cloudflare', async function () {
        fetch.mockResolvedValueOnce({ status: 403, headers: { get: () => null } })
        return expect(FeedFetcher.fetchURL('abc', {}, true)).rejects.toBeInstanceOf(RequestError)
      })
      it('throws a RequestError with an unsupported Cloudflare message if cloudflare and config._vip is true', function (done) {
        const origVal = config._vip
        config._vip = true
        fetch
          .mockResolvedValueOnce({ status: 403, headers: { get: () => ['cloudflare'] } })
        FeedFetcher.fetchURL('abc', {}, true)
          .then(() => done(new Error('Promise resolved')))
          .catch(err => {
            expect(err).toBeInstanceOf(RequestError)
            config._vip = origVal
            done()
          })
          .catch(done)
      })
      it('attaches the error code to the error thrown if cloudflare and config._vip is true', function (done) {
        const origVal = config._vip
        config._vip = true
        fetch
          .mockResolvedValueOnce({ status: 403, headers: { get: () => ['cloudflare'] } })
        FeedFetcher.fetchURL('abc', {}, true)
          .then(() => done(new Error('Promise resolved')))
          .catch(err => {
            expect(err.code).toEqual(FeedFetcher.REQUEST_ERROR_CODE)
            config._vip = origVal
            done()
          })
          .catch(done)
      })
      it('calls fetchCloudScraper if is cloudflare and config._vip is false', async function () {
        const origFunc = FeedFetcher.fetchCloudScraper
        FeedFetcher.fetchCloudScraper = jest.fn()
        fetch
          .mockResolvedValue({ status: 403, headers: { get: () => ['cloudflare'] } })
        await FeedFetcher.fetchURL('a', {}, true)
        expect(FeedFetcher.fetchCloudScraper).toHaveBeenCalledTimes(1)
        FeedFetcher.fetchCloudScraper = origFunc
      })
    })
  })
  describe('fetchCloudScraper', function () {
    afterEach(function () {
      cloudscraper.mockReset()
    })
    it('throws an Error if url is not defined', function () {
      return expect(FeedFetcher.fetchCloudScraper())
        .rejects.toBeInstanceOf(Error)
    })
    it('throws a RequestError if res status code is not 200', function () {
      cloudscraper.mockResolvedValueOnce({ statusCode: 401 })
      return expect(FeedFetcher.fetchCloudScraper('d'))
        .rejects.toBeInstanceOf(RequestError)
    })
    it('attaches the error code to the error if res status code is not 200', function (done) {
      cloudscraper.mockResolvedValueOnce({ statusCode: 401 })
      FeedFetcher.fetchCloudScraper('abc')
        .then(() => done(new Error('Promise resolved')))
        .catch(err => {
          expect(err.code).toEqual(FeedFetcher.REQUEST_ERROR_CODE)
          done()
        })
        .catch(done)
    })
    it('returns an object with a stream if request succeeds', async function () {
      const response = { statusCode: 200, body: 'abc' }
      cloudscraper.mockResolvedValueOnce(response)
      const data = await FeedFetcher.fetchCloudScraper('abc')
      expect(data.stream).toBeInstanceOf(Readable)
    })
    it('throws a RequestError if cloudscraper fails', async function () {
      const error = new Error('Hello world')
      cloudscraper.mockRejectedValueOnce(error)
      await expect(FeedFetcher.fetchCloudScraper('asdeg'))
        .rejects.toThrowError(new RequestError(error.message))
    })
  })
  describe('parseStream', function () {
    it('throws an error if no url is defined', function () {
      return expect(FeedFetcher.parseStream({})).rejects.toBeInstanceOf(Error)
    })
    it('rejects if the stream emits an error', function (done) {
      const stream = new Readable()
      const error = new Error('aszf')
      stream.pipe = jest.fn(() => {
        stream.emit('error', error)
      })
      FeedFetcher.parseStream(stream, 'asd')
        .then(() => {
          done(new Error('Promise Resolved'))
        })
        .catch(err => {
          expect(err).toEqual(error)
          done()
        })
        .catch(done)
    })
    it.todo('rejects with a FeedParserError if feedparser emits an error')
    it.todo('rejects with the feedparser error code if the error is not a feed')
    it.todo('attaches the ._id property to all articles')
    it.todo('returns the article list with the id type')
  })
  describe('fetchFeed', function () {
    const origFetchURL = FeedFetcher.fetchURL
    const origParseStream = FeedFetcher.parseStream
    const fetchURLResults = { stream: 'abc' }
    beforeEach(function () {
      FeedFetcher.fetchURL = jest.fn(() => fetchURLResults)
      FeedFetcher.parseStream = jest.fn(() => ({}))
    })
    afterEach(function () {
      FeedFetcher.fetchURL = origFetchURL
      FeedFetcher.parseStream = origParseStream
    })
    it('passes the url and options to fetchURL', async function () {
      const url = 'abc'
      const opts = { a: 'b', c: 1 }
      await FeedFetcher.fetchFeed(url, opts)
      expect(FeedFetcher.fetchURL).toHaveBeenCalledWith(url, opts)
    })
    it('passes the stream from fetchURL and url to parseStream', async function () {
      const url = 'abzz'
      await FeedFetcher.fetchFeed(url)
      expect(FeedFetcher.parseStream).toHaveBeenCalledWith(fetchURLResults.stream, url)
    })
    it('returns the articleList and idType', async function () {
      const results = await FeedFetcher.fetchFeed()
      expect(results.hasOwnProperty('articleList')).toEqual(true)
      expect(results.hasOwnProperty('idType')).toEqual(true)
    })
  })
  describe('fetchRandomArticle', function () {
    const origFetchURL = FeedFetcher.fetchFeed
    const origMathRand = Math.random
    const randNum = 0.7
    beforeEach(function () {
      FeedFetcher.fetchFeed = jest.fn()
      Math.random = jest.fn(() => randNum)
    })
    afterEach(function () {
      FeedFetcher.fetchFeed = origFetchURL
      Math.random = origMathRand
    })
    it('returns null if articleList length is 0', function () {
      FeedFetcher.fetchFeed.mockResolvedValue({ articleList: [] })
      return expect(FeedFetcher.fetchRandomArticle()).resolves.toEqual(null)
    })
    it('returns a random article with no filters', function () {
      const articleList = []
      const articleCount = 150
      for (let i = 0; i < articleCount; ++i) {
        articleList.push(i)
      }
      FeedFetcher.fetchFeed.mockResolvedValueOnce({ articleList })
      const expectedIndex = Math.round(randNum * (articleList.length - 1))
      return expect(FeedFetcher.fetchRandomArticle()).resolves.toEqual(articleList[expectedIndex])
    })
    it('returns null if there are no filtered articles if filters are passed in', function () {
      FeedFetcher.fetchFeed.mockResolvedValueOnce({ articleList: [1, 2, 3] })
      jest.spyOn(Article.prototype, 'testFilters')
        .mockReturnValue({ passed: false })
      return expect(FeedFetcher.fetchRandomArticle('a', { a: 'b' })).resolves.toEqual(null)
    })
    it('returns a random article within the the filtered articles if filters are passed in', function () {
      const articleList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      FeedFetcher.fetchFeed.mockResolvedValueOnce({ articleList })
      const filterFunc = item => item >= 5
      for (let i = 0; i < articleList.length; ++i) {
        jest.spyOn(Article.prototype, 'testFilters').mockReturnValueOnce({
          passed: filterFunc(articleList[i])
        })
      }
      const filteredArticleList = articleList.filter(filterFunc)
      const expectedIndex = Math.round(randNum * (filteredArticleList.length - 1))
      return expect(FeedFetcher.fetchRandomArticle('a', { a: 'b' })).resolves.toEqual(filteredArticleList[expectedIndex])
    })
  })
})
