const FeedFetcher = require('../../util/FeedFetcher.js')
const fetch = require('node-fetch')
const DecodedFeedParser = require('../../structs/DecodedFeedParser.js')
// const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')
// const Article = require('../../structs/Article.js')
// const testFilters = require('../../rss/translator/filters.js')
const RequestError = require('../../structs/errors/RequestError.js')
const cloudscraper = require('cloudscraper')
const config = require('../../config.js')
const Readable = require('stream').Readable

jest.mock('node-fetch')
jest.mock('cloudscraper')
jest.mock('../../config.js')
jest.mock('../../structs/ArticleIDResolver.js')
jest.mock('../../structs/Article.js')
jest.mock('../../rss/translator/filters.js')
jest.mock('../../structs/DecodedFeedParser.js')

describe('Unit::FeedFetcher', function () {
  afterEach(function () {
    fetch.mockReset()
  })
  it('throws an error if it is instantiated', function () {
    expect(() => new FeedFetcher()).toThrowError()
  })
  describe('fetchURL', function () {
    describe('retried is false', function () {
      it('throws an error if url is not defined', function () {
        expect(FeedFetcher.fetchURL()).rejects.toBeInstanceOf(Error)
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
        fetch
          .mockResolvedValueOnce({ status: 403, headers: { get: () => null } })
        expect(FeedFetcher.fetchURL('abc', {}, true)).rejects.toBeInstanceOf(RequestError)
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
      expect(FeedFetcher.fetchCloudScraper()).rejects.toBeInstanceOf(Error)
    })
    it('throws a RequestError if res status code is not 200', function () {
      cloudscraper.mockResolvedValueOnce({ statusCode: 401 })
      expect(FeedFetcher.fetchCloudScraper('d')).rejects.toBeInstanceOf(RequestError)
    })
    it('attaches the error code tto the error if res status code is not 200', function (done) {
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
  })
  describe('parseStream', function () {
    it('throws an error if no url is defined', function () {
      expect(FeedFetcher.parseStream({})).rejects.toBeInstanceOf(Error)
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
    it.todo('passes the url and options to fetchURl')
    it.todo('passes the stream from fetchURL to parseStream')
    it.todo('returns the articleList and idType')
  })
  describe('fetchRandomArticle', function () {
    it.todo('returns null if articleList length is 0')
    it.todo('returns a random article with no filters')
    it.todo('returns a random article within the the filtered articles if filters are passed in')
  })
})
