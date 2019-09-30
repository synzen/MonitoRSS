const ArticleMessage = require('../../structs/ArticleMessage.js')
const Article = require('../../structs/Article.js')
const storage = require('../../util/storage.js')
const filters = require('../../rss/translator/filters.js')
jest.mock('discord.js')
jest.mock('../../util/logger.js')
jest.mock('../../structs/Article.js')
jest.mock('../../rss/translator/filters.js')
jest.mock('../../util/storage.js')
storage.bot = { channels: { get: () => ({}) } }

describe('Unit::ArticleMessage', function () {
  describe('constructor', function () {
    const rawArticle = { _delivery: { source: { channel: 'abc', filters: { a: 1 } }, rssName: 'asd' } }
    const rawArticleWithNoFilters = { _delivery: { source: { channel: 'abc' }, rssName: 'asd' } }

    const testDetails = 'wseirtg4yjr'
    const generatedMessage = { text: 'awszf', embeds: [1, 2] }
    beforeAll(function () {
      jest.spyOn(ArticleMessage.prototype, '_generateMessage').mockImplementation(() => generatedMessage)
      jest.spyOn(ArticleMessage.prototype, '_generateTestMessage').mockImplementation(() => testDetails)
    })
    afterEach(function () {
      filters.mockReset()
    })
    afterAll(function () {
      jest.restoreAllMocks()
    })
    it('throws an error if _delivery is missing', function () {
      expect(() => new ArticleMessage({})).toThrowError(expect.objectContaining({ message: expect.stringContaining('_delivery property missing') }))
    })
    it('throws an error if _delivery.rssName is missing', function () {
      expect(() => new ArticleMessage({ _delivery: { source: {} } })).toThrowError(expect.objectContaining({ message: expect.stringContaining('rssName property missing') }))
    })
    it('throws an error if _delivery.source is missing', function () {
      expect(() => new ArticleMessage({ _delivery: { rssName: 'asdasd' } })).toThrowError(expect.objectContaining({ message: expect.stringContaining('source property missing') }))
    })
    it('defines the correct properties for this.parsedArticle', function () {
      const parsedArticle = { foo: 'bar', subscriptionIds: [1, 4, 5] }
      Article.mockImplementationOnce(() => parsedArticle)
      const m = new ArticleMessage(rawArticleWithNoFilters)
      expect(m.parsedArticle).toEqual(parsedArticle)
      expect(m.channelId).toEqual(rawArticle._delivery.source.channel)
      expect(m.rssName).toEqual(rawArticle._delivery.rssName)
      expect(m.text).toEqual(generatedMessage.text)
      expect(m.embeds).toEqual(generatedMessage.embeds)
      expect(m.subscriptionIds).toEqual(parsedArticle.subscriptionIds)
      expect(m.isTestMessage).toEqual(false)
      expect(m.skipFilters).toEqual(false)
    })
    it('defines test details if is testmessage', function () {
      const m = new ArticleMessage(rawArticle, true)
      expect(m.isTestMessage).toEqual(true)
      expect(m.testDetails).toEqual(testDetails)
    })
    it('attaches filter results if passed', function () {
      const filterResults = { a: 1, passed: true }
      filters.mockImplementationOnce(() => filterResults)
      const m = new ArticleMessage(rawArticle)
      expect(m.filterResults).toEqual(filterResults)
      expect(m.passedFilters).toEqual(filterResults.passed)
    })
    it('attaches filter results if not passed', function () {
      const filterResults = { a: 1, passed: false }
      filters.mockImplementationOnce(() => filterResults)
      const m = new ArticleMessage(rawArticle)
      expect(m.filterResults).toEqual(filterResults)
      expect(m.passedFilters).toEqual(filterResults.passed)
    })
    it('passes filters if there are no filters in sources', function () {
      const m = new ArticleMessage(rawArticleWithNoFilters)
      expect(m.passedFilters).toEqual(true)
    })
    it('does not attach filter results if skip filters', function () {
      const filterResults = { a: 1, passed: false }
      filters.mockImplementationOnce(() => filterResults)
      const m = new ArticleMessage(rawArticle, false, true)
      expect(m.skipFilters).toEqual(true)
      expect(m.passedFilters).toEqual(true)
    })
  })
  describe('send()', function () {
    it.todo('throws an error if missing source')
    it.todo('throws an error if missing channel')
  })
})
