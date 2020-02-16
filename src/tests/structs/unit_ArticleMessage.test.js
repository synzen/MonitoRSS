const ArticleMessage = require('../../structs/ArticleMessage.js')
const Article = require('../../structs/Article.js')
jest.mock('discord.js')
jest.mock('../../util/logger.js')
jest.mock('../../structs/Article.js')
jest.mock('../../util/storage.js')

const Bot = () => ({
  channels: {
    cache: {
      get: () => ({})
    }
  }
})

describe('Unit::ArticleMessage', function () {
  describe('constructor', function () {
    const rawArticle = {
      _feed: {
        channel: 'abc',
        filters: { a: 1 },
        rfilters: {},
        filteredFormats: []
      }
    }
    const rawArticleWithNoFilters = {
      _feed: {
        channel: 'abc',
        filters: {},
        rfilters: {},
        filteredFormats: []
      }
    }

    const testDetails = 'wseirtg4yjr'
    const generatedMessage = { text: 'awszf', embeds: [1, 2] }
    beforeEach(function () {
      jest.spyOn(ArticleMessage.prototype, '_generateMessage')
        .mockImplementation(() => generatedMessage)
      jest.spyOn(ArticleMessage.prototype, '_generateTestMessage')
        .mockImplementation(() => testDetails)
      jest.spyOn(Article.prototype, 'testFilters')
        .mockReturnValue({ passed: true })
    })
    afterEach(function () {
      jest.restoreAllMocks()
    })
    it('throws an error if _feed is missing', function () {
      expect(() => new ArticleMessage(Bot(), {}))
        .toThrowError('article._feed property missing')
    })
    it('defines the correct properties for this.parsedArticle', function () {
      const parsedArticle = { foo: 'bar', subscriptionIds: [1, 4, 5], testFilters: jest.fn() }
      Article.mockImplementationOnce(() => parsedArticle)
      const m = new ArticleMessage(Bot(), rawArticleWithNoFilters)
      expect(m.parsedArticle).toEqual(parsedArticle)
      expect(m.channelId).toEqual(rawArticle._feed.channel)
      expect(m.text).toEqual(generatedMessage.text)
      expect(m.embeds).toEqual(generatedMessage.embeds)
      expect(m.subscriptionIds).toEqual(parsedArticle.subscriptionIds)
      expect(m.isTestMessage).toEqual(false)
      expect(m.skipFilters).toEqual(false)
    })
    it('defines test details if is testmessage', function () {
      const m = new ArticleMessage(Bot(), rawArticle, true)
      expect(m.isTestMessage).toEqual(true)
      expect(m.testDetails).toEqual(testDetails)
    })
    it('attaches filter results if passed', function () {
      const filterResults = { a: 1, passed: true }
      jest.spyOn(Article.prototype, 'testFilters').mockReturnValue(filterResults)
      const m = new ArticleMessage(Bot(), rawArticle)
      expect(m.filterResults).toEqual(filterResults)
      expect(m.passedFilters()).toEqual(filterResults.passed)
    })
    it('attaches filter results if not passed', function () {
      const filterResults = { a: 1, passed: false }
      jest.spyOn(Article.prototype, 'testFilters').mockReturnValue(filterResults)
      const m = new ArticleMessage(Bot(), rawArticle)
      expect(m.filterResults).toEqual(filterResults)
      expect(m.passedFilters()).toEqual(filterResults.passed)
    })
    it('passes filters if there are no filters in feed', function () {
      jest.spyOn(Article.prototype, 'testFilters').mockReturnValue({ passed: true })
      const m = new ArticleMessage(Bot(), rawArticleWithNoFilters)
      expect(m.passedFilters()).toEqual(true)
    })
    it('does not attach filter results if skip filters', function () {
      const filterResults = { a: 1, passed: false }
      jest.spyOn(Article.prototype, 'testFilters').mockReturnValue(filterResults)
      const m = new ArticleMessage(Bot(), rawArticle, false, true)
      expect(m.skipFilters).toEqual(true)
      expect(m.passedFilters()).toEqual(true)
    })
  })
  describe('send()', function () {
    const rawArticle = {
      _feed: {
        filters: {},
        rfilters: {},
        filteredFormats: []
      }
    }
    beforeEach(function () {
      const generatedMessage = { text: 'awszf', embeds: [1, 2] }
      jest.spyOn(ArticleMessage.prototype, '_resolveWebhook')
        .mockImplementation()
      jest.spyOn(ArticleMessage.prototype, '_createSendOptions')
        .mockImplementation(() => generatedMessage)
    })
    afterEach(function () {
      jest.restoreAllMocks()
    })
    it('throws an error if missing feed', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.feed = undefined
      return expect(m.send()).rejects.toBeInstanceOf(Error)
    })
    it('throws an error if missing channel', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.channel = undefined
      return expect(m.send()).rejects.toBeInstanceOf(Error)
    })
    it('does not send the article if it did not pass filters', async function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      const medium = { send: jest.fn(async () => Promise.resolve()) }
      m.passedFilters = () => false
      m.channel = medium
      await m.send()
      expect(medium.send).not.toHaveBeenCalled()
    })
    it('sends via webhook if it exists', async function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      const channel = { send: jest.fn(async () => Promise.resolve()) }
      const webhook = { send: jest.fn(async () => Promise.resolve()) }
      m.channel = channel
      m.webhook = webhook
      m.filterResults = { passed: true }
      await m.send()
      expect(webhook.send).toHaveBeenCalledTimes(1)
    })
    it('throws the same error that channel.send throws ', async function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      const error = new Error('hello world')
      error.code = 5555
      const channel = { send: jest.fn(async () => Promise.reject(error)) }
      m.channel = channel
      m.filterResults = { passed: true }
      try {
        await m.send()
        throw new Error('Send promise resolved')
      } catch (err) {
        expect(err).toEqual(error)
      }
    })
    it('does not retry if errorCode is 50013', async function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      const error = new Error('hello world')
      error.code = 50013
      const channel = { send: jest.fn(async () => Promise.reject(error)) }
      m.channel = channel
      m.filterResults = { passed: true }
      try {
        await m.send()
        throw new Error('Send promise resolved')
      } catch (err) {
        expect(channel.send).toHaveBeenCalledTimes(1)
      }
    })
    it('retries a maximum of 4 times with an unrecognized error', async function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.filterResults = { passed: true }
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
      const m = new ArticleMessage(Bot(), rawArticle)
      const channel = { send: jest.fn(async () => Promise.resolve()) }
      m.channel = channel
      m.isTestMessage = true
      m.filterResults = { passed: true }
      await m.send()
      expect(m.isTestMessage).toEqual(false)
      expect(channel.send).toHaveBeenCalledTimes(2)
    })
    it('regenerates message with character limits if this.split is true and error is about message with >2000 chars', async function () {
      const generated = {
        embeds: [1, 2, 3],
        text: 'adsefgrth'
      }
      const m = new ArticleMessage(Bot(), rawArticle)
      jest.spyOn(m, '_generateMessage').mockReturnValueOnce(generated)
      const error = new Error('2000 or fewer in length')
      const channel = { send: jest.fn(async () => Promise.resolve()) }
      channel.send.mockImplementationOnce(async () => Promise.reject(error))
      m.channel = channel
      m.split = { a: 1 }
      m.filterResults = { passed: true }
      await m.send()
      expect(channel.send).toHaveBeenCalledTimes(2)
      expect(m.split).toBeUndefined()
      expect(m.text).toEqual(generated.text)
      expect(m.embeds).toEqual(generated.embeds)
    })
    it('regenerates message with character limits if this.split is true and error is about no split characters', async function () {
      const generated = {
        embeds: [1, 6, 3],
        text: 'adsefftjgugrth'
      }
      const splitOptions = { b: 2 }
      const m = new ArticleMessage(Bot(), rawArticle)
      jest.spyOn(m, '_generateMessage').mockReturnValueOnce(generated)
      const error = new Error('no split characters')
      const channel = { send: jest.fn(async () => Promise.resolve()) }
      channel.send.mockImplementationOnce(async () => Promise.reject(error))
      m.channel = channel
      m.split = splitOptions
      m.filterResults = { passed: true }
      await m.send()
      expect(channel.send).toHaveBeenCalledTimes(2)
      expect(m.split).toEqual(splitOptions)
      expect(m.text).toEqual(generated.text)
      expect(m.embeds).toEqual(generated.embeds)
    })
  })
  describe('_createSendOptions', function () {
    const rawArticle = {
      _feed: {
        filters: {},
        rfilters: {},
        filteredFormats: []
      }
    }
    beforeEach(function () {
      jest.spyOn(ArticleMessage.prototype, '_convertEmbeds').mockImplementation()
    })
    it('returns text that is the test message if it is a test message', function () {
      const testMessage = 'adzesgtwioug'
      const m = new ArticleMessage(Bot(), rawArticle)
      m.isTestMessage = true
      m.testDetails = testMessage
      const data = m._createSendOptions()
      expect(data.text).toEqual(testMessage)
    })
    it('returns the webhook if there is a webhook', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.webhook = { name: 'foo', avatar: 'bar' }
      m.text = 'abc'
      m.article = {}
      const data = m._createSendOptions()
      expect(data.options.username).toEqual('foo')
      expect(data.options.avatarURL).toEqual('bar')
    })
    it('returns the text', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.text = 'abc'
      m.article = {}
      const data = m._createSendOptions()
      expect(data.text).toEqual(m.text)
    })
    it('returns the first embed in a list of embeds if there is no webhook', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.text = 'abc'
      m.embeds = [1, 2, 3]
      const data = m._createSendOptions()
      expect(data.options.embed).toEqual(m.embeds[0])
      expect(data.options.embeds).toBeUndefined()
    })
    it('returns all the embeds in a list there is a webhook', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.webhook = { name: 'foo', avatar: 'bar' }
      m.text = 'abc'
      m.embeds = [1, 2, 3]
      const data = m._createSendOptions()
      expect(data.options.embed).toBeUndefined()
      expect(data.options.embeds).toEqual(m.embeds)
    })
    it('does not attach user split options if it is a test message (it uses the static TEST_OPTIONS)', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.isTestMessage = true
      m.split = { a: 'b' }
      m.filterResults = { passed: true }
      const data = m._createSendOptions()
      expect(data.options).toEqual(ArticleMessage.TEST_OPTIONS)
    })
    it('attaches user split options for non-test-message', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.split = { a: 'b' }
      m.article = {}
      m.text = 'aszf'
      const data = m._createSendOptions()
      expect(data.options.split).toEqual(m.split)
    })
    it('changes the text to error if there is no split and the text exceeds 1950 length', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.article = {}
      m.text = ''
      while (m.text.length < 2000) {
        m.text += 'awsfdegrhk'
      }
      const data = m._createSendOptions()
      expect(data.text).toEqual(expect.stringContaining('>1950'))
    })
    it('changes the text to error if there is no text and no embeds', function () {
      const m = new ArticleMessage(Bot(), rawArticle)
      m.article = {}
      m.text = ''
      const data = m._createSendOptions()
      expect(data.text).toEqual(expect.stringContaining('empty message'))
    })
  })
})
