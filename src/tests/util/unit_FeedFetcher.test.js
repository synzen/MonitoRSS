const FeedFetcher = require('../../util/FeedFetcher.js')
// const fetch = require('node-fetch')
// const DecodedFeedParser = require('../../structs/DecodedFeedParser.js')
// const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')
// const Article = require('../../structs/Article.js')
// const testFilters = require('../../rss/translator/filters.js')
// const RequestError = require('../../structs/errors/RequestError.js')
// const config = require('../../config.js')

jest.mock('node-fetch')
jest.mock('../../config.js')
jest.mock('../../structs/ArticleIDResolver.js')
jest.mock('../../structs/Article.js')
jest.mock('../../rss/translator/filters.js')

describe('Unit::FeedFetcher', function () {
  it('throws an error if it is instantiated', function () {
    expect(() => new FeedFetcher()).toThrowError()
  })
  describe('fetchURL', function () {
    describe('retried is false', function () {
      it.todo('throws an error if url is not defined')
      it.todo('passes the request options to fetch')
      it.todo('does no recursive call if retried is true')
      it.todo('throws a RequestError if fetch throws an error')
      it.todo('returns the stream and response if the response status is 200')
      it.todo('returns the stream and response if the response status is 304 with If-Modified-Since and If-None-Match is in request headers')
      it.todo('recursively tries again if res status is 403/400 but with no headers')
    })
    describe('retried is true', function () {
      it.todo('throws a RequestError if res headers does not include cloudflare')
      it.todo('throws a RequestError with an unsupported Cloudflare message if cloudflare and config._vip is true')
      it.todo('calls fetchCloudScraper if is cloudflare and config._vip is false')
    })
  })
  describe('fetchCloudScraper', function () {
    it.todo('throws a RequestError if res status code is not 200')
    it.todo('returns an object with a stream if request succeeds')
  })
  describe('parseStream', function () {
    it.todo('rejects if the stream emits an error')
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
