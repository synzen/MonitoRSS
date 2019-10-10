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
    const rawArticle = { _delivery: { rssName: 'hel', source: {} } }
    beforeAll(function () {
      const generatedMessage = { text: 'awszf', embeds: [1, 2] }
      jest.spyOn(ArticleMessage.prototype, '_resolveWebhook').mockImplementation()
      jest.spyOn(ArticleMessage.prototype, '_createSendOptions').mockImplementation(() => generatedMessage)
    })
    afterAll(function () {
      jest.restoreAllMocks()
    })
    it('throws an error if missing source', function () {
      const m = new ArticleMessage(rawArticle)
      m.source = undefined
      return expect(m.send()).rejects.toBeInstanceOf(Error)
    })
    it('throws an error if missing channel', function () {
      const m = new ArticleMessage(rawArticle)
      m.channel = undefined
      return expect(m.send()).rejects.toBeInstanceOf(Error)
    })
    it('does not send the article if it did not pass filters', async function () {
      const m = new ArticleMessage(rawArticle)
      const medium = { send: jest.fn(async () => Promise.resolve()) }
      m.passedFilters = false
      m.channel = medium
      await m.send()
      expect(medium.send).not.toHaveBeenCalled()
    })
    it('sends via webhook if it exists', async function () {
      const m = new ArticleMessage(rawArticle)
      const channel = { send: jest.fn(async () => Promise.resolve()) }
      const webhook = { send: jest.fn(async () => Promise.resolve()) }
      m.channel = channel
      m.webhook = webhook
      await m.send()
      expect(webhook.send).toHaveBeenCalledTimes(1)
    })
    it('throws the same error that channel.send throws ', async function () {
      const m = new ArticleMessage(rawArticle)
      const error = new Error('hello world')
      error.code = 5555
      const channel = { send: jest.fn(async () => Promise.reject(error)) }
      m.channel = channel
      try {
        await m.send()
        throw new Error('Send promise resolved')
      } catch (err) {
        expect(err).toEqual(error)
      }
    })
    it('does not retry if errorCode is 50013', async function () {
      const m = new ArticleMessage(rawArticle)
      const error = new Error('hello world')
      error.code = 50013
      const channel = { send: jest.fn(async () => Promise.reject(error)) }
      m.channel = channel
      try {
        await m.send()
        throw new Error('Send promise resolved')
      } catch (err) {
        expect(channel.send).toHaveBeenCalledTimes(1)
      }
    })
    it('retries a maximum of 4 times with an unrecognized error', async function () {
      const m = new ArticleMessage(rawArticle)
      const error = new Error('hello world')
      const channel = { send: jest.fn(async () => Promise.reject(error)) }
      m.channel = channel
      try {
        await m.send()
        throw new Error('Send promise resolved')
      } catch (err) {
        expect(channel.send).toHaveBeenCalledTimes(4)
      }
    })
    it('sends two times and sets isTestMessage to false on second run', async function () {
      const m = new ArticleMessage(rawArticle)
      const channel = { send: jest.fn(async () => Promise.resolve()) }
      m.channel = channel
      m.isTestMessage = true
      await m.send()
      expect(m.isTestMessage).toEqual(false)
      expect(channel.send).toHaveBeenCalledTimes(2)
    })
    it('regenerates message with character limits if this.split is true and error is about message with >2000 chars', async function () {
      const generated = {
        embeds: [1, 2, 3],
        text: 'adsefgrth'
      }
      const m = new ArticleMessage(rawArticle)
      jest.spyOn(m, '_generateMessage').mockReturnValueOnce(generated)
      const error = new Error('2000 or fewer in length')
      const channel = { send: jest.fn(async () => Promise.resolve()) }
      channel.send.mockImplementationOnce(async () => Promise.reject(error))
      m.channel = channel
      m.split = { a: 1 }
      await m.send()
      expect(channel.send).toHaveBeenCalledTimes(2)
      expect(m.split).toBeUndefined()
      expect(m.text).toEqual(generated.text)
      expect(m.embeds).toEqual(generated.embeds)
    })
    it.only('regenerates message with character limits if this.split is true and error is about no split characters', async function () {
      const generated = {
        embeds: [1, 6, 3],
        text: 'adsefftjgugrth'
      }
      const splitOptions = { b: 2 }
      const m = new ArticleMessage(rawArticle)
      jest.spyOn(m, '_generateMessage').mockReturnValueOnce(generated)
      const error = new Error('no split characters')
      const channel = { send: jest.fn(async () => Promise.resolve()) }
      channel.send.mockImplementationOnce(async () => Promise.reject(error))
      m.channel = channel
      m.split = splitOptions
      await m.send()
      expect(channel.send).toHaveBeenCalledTimes(2)
      expect(m.split).toEqual(splitOptions)
      expect(m.text).toEqual(generated.text)
      expect(m.embeds).toEqual(generated.embeds)
    })
  })
})
