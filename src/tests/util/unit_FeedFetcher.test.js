process.env.TEST_ENV = true
const FeedFetcher = require('../../util/FeedFetcher.js')
const fetch = require('node-fetch')
const Article = require('../../structs/Article.js')
const RequestError = require('../../structs/errors/RequestError.js')
const AbortController = require('abort-controller').AbortController
const cloudscraper = require('cloudscraper')
const config = require('../../config.js')
const Readable = require('stream').Readable

jest.mock('node-fetch')
jest.mock('cloudscraper')
jest.mock('../../config.js', () => ({
  get: jest.fn(() => ({
    _vip: false
  }))
}))
jest.mock('../../structs/ArticleIDResolver.js')
jest.mock('../../structs/Article.js')
jest.mock('../../structs/DecodedFeedParser.js')
jest.mock('abort-controller')
jest.useFakeTimers()

describe('Unit::FeedFetcher', function () {
  afterEach(function () {
    AbortController.mockRestore()
    jest.restoreAllMocks()
    fetch.mockReset()
    config.get.mockReturnValue({
      _vip: false
    })
  })
  it('throws an error if it is instantiated', function () {
    expect(() => new FeedFetcher()).toThrowError()
  })
  describe('static formatNodeFetchResponse', function () {
    it('converts headers to lowercase', function () {
      const headers = {
        HELLO: 'world',
        CAPITAL: 'punish'
      }
      const res = {
        headers: {
          raw: jest.fn(() => headers)
        }
      }
      const expectedHeaders = {
        hello: 'world',
        capital: 'punish'
      }
      expect(FeedFetcher.formatNodeFetchResponse({ ...res }).headers)
        .toEqual(expectedHeaders)
    })
    it('converts array etag to string', function () {
      const headers = {
        etag: ['world']
      }
      const res = {
        headers: {
          raw: jest.fn(() => headers)
        }
      }
      const expectedHeaders = {
        etag: headers.etag[0]
      }
      expect(FeedFetcher.formatNodeFetchResponse({ ...res }).headers)
        .toEqual(expectedHeaders)
    })
    it('converts array last-modified to string', function () {
      const headers = {
        'last-modified': ['world']
      }
      const res = {
        headers: {
          raw: jest.fn(() => headers)
        }
      }
      const expectedHeaders = {
        'last-modified': headers['last-modified'][0]
      }
      expect(FeedFetcher.formatNodeFetchResponse({ ...res }).headers)
        .toEqual(expectedHeaders)
    })
    it('converts array content-type to string', function () {
      const headers = {
        'content-type': ['world']
      }
      const res = {
        headers: {
          raw: jest.fn(() => headers)
        }
      }
      const expectedHeaders = {
        'content-type': headers['content-type'][0]
      }
      expect(FeedFetcher.formatNodeFetchResponse({ ...res }).headers)
        .toEqual(expectedHeaders)
    })
    it('returns status and headers object', function () {
      const headers = {
        jack: 'h',
        fo: 'do'
      }
      const res = {
        status: 200,
        headers: {
          raw: jest.fn(() => ({ ...headers }))
        }
      }
      const expectedReturn = {
        status: res.status,
        headers
      }
      expect(FeedFetcher.formatNodeFetchResponse({ ...res }))
        .toEqual(expectedReturn)
    })
  })
  describe('static formatCloudscraperResponse', function () {
    it('converts headers to lowercase', function () {
      const headers = {
        HELLO: 'world',
        CAPITAL: 'punish'
      }
      const res = {
        headers
      }
      const expectedHeaders = {
        hello: 'world',
        capital: 'punish'
      }
      expect(FeedFetcher.formatCloudscraperResponse(res).headers)
        .toEqual(expectedHeaders)
    })
    it('returns status and headers object', function () {
      const headers = {
        jack: 'h',
        fo: 'do'
      }
      const res = {
        statusCode: 200,
        headers: { ...headers }
      }
      const expectedReturn = {
        status: 200,
        headers
      }
      expect(FeedFetcher.formatCloudscraperResponse({ ...res }))
        .toEqual(expectedReturn)
    })
  })
  describe('createFetchOptions', function () {
    afterEach(function () {
      jest.clearAllTimers()
    })
    it('adds the request options', function () {
      const requestOptions = {
        foo: 'bar',
        bz: 'da'
      }
      const returned = FeedFetcher.createFetchOptions('asd', requestOptions)
      expect(returned.options)
        .toEqual(expect.objectContaining(requestOptions))
    })
    it('adds the headers', function () {
      const headers = {
        foz: 'baz'
      }
      const requestOptions = {
        headers
      }
      const returned = FeedFetcher.createFetchOptions('asd', requestOptions)
      expect(returned.options.headers)
        .toEqual(expect.objectContaining(headers))
    })
    it('adds the abort signal', function () {
      const signal = jest.fn()
      const abort = jest.fn()
      const controller = {
        signal,
        abort
      }
      AbortController.mockReturnValue(controller)
      const returned = FeedFetcher.createFetchOptions('asd', {})
      expect(returned.options.signal).toEqual(signal)
    })
    it('aborts the signal in 15s', function () {
      const signal = jest.fn()
      const abort = jest.fn()
      const controller = {
        signal,
        abort
      }
      AbortController.mockReturnValue(controller)
      FeedFetcher.createFetchOptions('asd', {})
      jest.runAllTimers()
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 15000)
      expect(abort).toHaveBeenCalled()
    })
  })
  describe('fetchURL', function () {
    beforeEach(function () {
      jest.spyOn(FeedFetcher, 'formatNodeFetchResponse').mockReturnValue({})
      jest.spyOn(FeedFetcher, 'createFetchOptions').mockReturnValue({
        options: {
          headers: {}
        }
      })
    })
    describe('retried is false', function () {
      it('throws an error if url is not defined', function () {
        return expect(FeedFetcher.fetchURL()).rejects.toBeInstanceOf(Error)
      })
      it('passes the options to fetch', async function () {
        const reqOpts = { a: 'b', c: 'd', e: 'f' }
        jest.spyOn(FeedFetcher, 'createFetchOptions')
          .mockReturnValue({
            options: reqOpts
          })
        fetch.mockResolvedValueOnce({ status: 200 })
        await FeedFetcher.fetchURL('abc', reqOpts)
        const passedObject = fetch.mock.calls[0][1]
        for (const key in reqOpts) {
          expect(passedObject[key]).toEqual(reqOpts[key])
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
      it('throws a RequestError if fetch throws an error', async function () {
        const error = new Error('abc')
        fetch.mockRejectedValueOnce(error)
        await expect(FeedFetcher.fetchURL('abc'))
          .rejects.toThrow(new RequestError(null, error.message))
      })
      it('returns the stream and response if the response status is 200', async function () {
        const body = 'abc'
        const response = { body, status: 200 }
        const parsedResponse = { fa: 1 }
        fetch.mockResolvedValueOnce(response)
        jest.spyOn(FeedFetcher, 'formatNodeFetchResponse').mockReturnValue(parsedResponse)
        const data = await FeedFetcher.fetchURL('abc')
        expect(data).toEqual({ stream: body, response: parsedResponse })
      })
      it('returns the stream and response if the response status is 304 with If-Modified-Since and If-None-Match is in request headers', async function () {
        const headers = { 'If-Modified-Since': 1, 'If-None-Match': 1 }
        jest.spyOn(FeedFetcher, 'createFetchOptions')
          .mockReturnValue({
            options: {
              headers
            }
          })
        const body = 'abc'
        const response = { body, status: 304 }
        const parsedResponse = { a: 1 }
        fetch.mockResolvedValueOnce(response)
        jest.spyOn(FeedFetcher, 'formatNodeFetchResponse').mockReturnValue(parsedResponse)
        const data = await FeedFetcher.fetchURL('abc', { headers })
        expect(data).toEqual({ stream: body, response: parsedResponse })
      })
      it('recursively calls again if res status is 403/400', async function () {
        fetch
          .mockResolvedValueOnce({ status: 403 })
          .mockResolvedValueOnce({ status: 200 })
        jest.spyOn(FeedFetcher, 'formatNodeFetchResponse')
          .mockReturnValue({ status: 200 })
        const spy = jest.spyOn(FeedFetcher, 'fetchURL')
        await FeedFetcher.fetchURL('abc')
        expect(spy).toHaveBeenCalledTimes(2)
      })
      it('recursively calls with empty user agent if res status is 403/400', async function () {
        const headers = { a: 'b', c: 'd' }
        const fetchURL = jest.spyOn(FeedFetcher, 'fetchURL')
        fetch
          .mockResolvedValueOnce({ status: 403 })
          .mockResolvedValueOnce({ status: 200 })
        jest.spyOn(FeedFetcher, 'formatNodeFetchResponse')
          .mockReturnValue({ status: 200 })
        await FeedFetcher.fetchURL('abc', { headers })
        expect(fetchURL.mock.calls[1][1].headers['user-agent']).toEqual('')
      })
    })
    describe('request failed and retried is true', function () {
      it('throws a RequestError if res headers does not include cloudflare', async function () {
        fetch.mockResolvedValueOnce({ status: 403, headers: { get: () => null } })
        return expect(FeedFetcher.fetchURL('abc', {}, true)).rejects.toBeInstanceOf(RequestError)
      })
      it.skip('throws a RequestError with an unsupported Cloudflare message if cloudflare and config._vip is true', function (done) {
        config.get.mockReturnValue({
          _vip: true
        })
        fetch
          .mockResolvedValueOnce({ status: 403, headers: { get: () => ['cloudflare'] } })
        FeedFetcher.fetchURL('abc', {}, true)
          .then(() => done(new Error('Promise resolved')))
          .catch(err => {
            expect(err).toBeInstanceOf(RequestError)
            done()
          })
          .catch(done)
      })
      it.skip('attaches the error code to the error thrown if cloudflare and config._vip is true', function (done) {
        config.get.mockReturnValue({
          _vip: true
        })
        fetch
          .mockResolvedValueOnce({ status: 403, headers: { get: () => ['cloudflare'] } })
        FeedFetcher.fetchURL('abc', {}, true)
          .then(() => done(new Error('Promise resolved')))
          .catch(err => {
            expect(err.code).toEqual(FeedFetcher.REQUEST_ERROR_CODE)
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
        .rejects.toThrowError(new RequestError(null, `Cloudflare - ${error.message}`))
    })
    it('throws a RequestError if error has bad status code', async function () {
      const error = new Error('Hello world')
      error.statusCode = 500
      cloudscraper.mockRejectedValueOnce(error)
      await expect(FeedFetcher.fetchCloudScraper('asdeg'))
        .rejects.toThrowError(new RequestError(error.statusCode, `Bad Cloudflare status code (${error.statusCode})`))
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
      jest.spyOn(FeedFetcher, 'getCharsetFromResponse')
        .mockImplementation()
      FeedFetcher.fetchURL = jest.fn(() => fetchURLResults)
      FeedFetcher.parseStream = jest.fn(() => ({}))
    })
    afterEach(function () {
      FeedFetcher.fetchURL = origFetchURL
      FeedFetcher.parseStream = origParseStream
    })
    it('passes the url, options and charset to fetchURL', async function () {
      const url = 'abc'
      const opts = { a: 'b', c: 1 }
      await FeedFetcher.fetchFeed(url, opts)
      expect(FeedFetcher.fetchURL).toHaveBeenCalledWith(url, opts)
    })
    it('passes the stream from fetchURL and url to parseStream', async function () {
      const url = 'abzz'
      const charset = 'aedswry'
      jest.spyOn(FeedFetcher, 'getCharsetFromResponse')
        .mockReturnValue(charset)
      await FeedFetcher.fetchFeed(url)
      expect(FeedFetcher.parseStream).toHaveBeenCalledWith(fetchURLResults.stream, url, charset)
    })
    it('returns the articleList and idType', async function () {
      const results = await FeedFetcher.fetchFeed()
      expect(Object.prototype.hasOwnProperty.call(results, 'articleList')).toEqual(true)
      expect(Object.prototype.hasOwnProperty.call(results, 'idType')).toEqual(true)
    })
  })
  describe('fetchFilteredFeed', function () {
    it('returns the filtered feed', async function () {
      const originalArticleList = [{
        a: 1
      }, {
        a: 2
      }, {
        a: 3
      }]
      jest.spyOn(FeedFetcher, 'fetchFeed')
        .mockResolvedValue({
          articleList: originalArticleList
        })
      jest.spyOn(Article.prototype, 'testFilters')
        .mockReturnValueOnce({ passed: true })
        .mockReturnValueOnce({ passed: false })
        .mockReturnValueOnce({ passed: false })
      const filtered = await FeedFetcher.fetchFilteredFeed()
      expect(filtered).toEqual({
        articleList: [originalArticleList[0]]
      })
    })
  })
  describe('fetchRandomArticle', function () {
    const origMathRand = Math.random
    const randNum = 0.7
    beforeEach(function () {
      Math.random = jest.fn(() => randNum)
    })
    afterEach(function () {
      Math.random = origMathRand
    })
    it('returns null if articleList length is 0', function () {
      jest.spyOn(FeedFetcher, 'fetchFeed')
        .mockResolvedValue({
          articleList: []
        })
      return expect(FeedFetcher.fetchRandomArticle()).resolves.toEqual(null)
    })
    it('returns a random article with no filters', function () {
      const articleList = []
      const articleCount = 150
      for (let i = 0; i < articleCount; ++i) {
        articleList.push(i)
      }
      jest.spyOn(FeedFetcher, 'fetchFeed')
        .mockResolvedValueOnce({
          articleList
        })
      const expectedIndex = Math.round(randNum * (articleList.length - 1))
      return expect(FeedFetcher.fetchRandomArticle())
        .resolves.toEqual(articleList[expectedIndex])
    })
    it('returns null if there are no filtered articles if filters are passed in', function () {
      jest.spyOn(FeedFetcher, 'fetchFilteredFeed')
        .mockResolvedValueOnce({
          articleList: []
        })
      return expect(FeedFetcher.fetchRandomArticle('a', { a: 'b' }))
        .resolves.toEqual(null)
    })
  })
  describe('static fetchLatestArticle', function () {
    it('returns the newest article', async function () {
      const now = new Date()
      const past = new Date(new Date().getTime() - 1000 * 60)
      const future = new Date(new Date().getTime() + 1000 * 60)
      const future2 = new Date(new Date().getTime() + 2000 * 60)
      const data = {
        articleList: [{
          pubDate: past
        }, {
          pubDate: future2
        }, {
          pubDate: now
        }, {
          pubDate: future
        }]
      }
      jest.spyOn(FeedFetcher, 'fetchFeed')
        .mockResolvedValue(data)
      await expect(FeedFetcher.fetchLatestArticle())
        .resolves.toEqual(data.articleList[1])
    })
    it('returns null if a date of one article is invalid', async function () {
      const invalid = new Date('4e3wyr5tu')
      const past = new Date(new Date().getTime() - 1000 * 60)
      const future = new Date(new Date().getTime() + 1000 * 60)
      const future2 = new Date(new Date().getTime() + 2000 * 60)
      const data = {
        articleList: [{
          pubDate: past
        }, {
          pubDate: future2
        }, {
          pubDate: invalid
        }, {
          pubDate: future
        }]
      }
      jest.spyOn(FeedFetcher, 'fetchFeed')
        .mockResolvedValue(data)
      await expect(FeedFetcher.fetchLatestArticle())
        .resolves.toEqual(null)
    })
    it('returns null if not all articles have dates', async function () {
      const invalid = new Date('4e3wyr5tu')
      const past = new Date(new Date().getTime() - 1000 * 60)
      const future = new Date(new Date().getTime() + 1000 * 60)
      const data = {
        articleList: [{
          pubDate: past
        }, {
        }, {
          pubDate: invalid
        }, {
          pubDate: future
        }]
      }
      jest.spyOn(FeedFetcher, 'fetchFeed')
        .mockResolvedValue(data)
      await expect(FeedFetcher.fetchLatestArticle())
        .resolves.toEqual(null)
    })
    it('returns null if there are no articles', async function () {
      const data = {
        articleList: []
      }
      jest.spyOn(FeedFetcher, 'fetchFeed')
        .mockResolvedValue(data)
      await expect(FeedFetcher.fetchLatestArticle())
        .resolves.toEqual(null)
    })
  })
  describe('static getCharsetFromResponse', function () {
    it('returns the charset', function () {
      const response = {
        headers: {
          'content-type': 'application/rss+xml; charset=ISO-8859-1'
        }
      }
      expect(FeedFetcher.getCharsetFromResponse(response))
        .toEqual('ISO-8859-1')
    })
    it('does not throw on incomplete headers', function () {
      const response = {
        headers: {}
      }
      expect(() => FeedFetcher.getCharsetFromResponse(response))
        .not.toThrow()
    })
  })
})
