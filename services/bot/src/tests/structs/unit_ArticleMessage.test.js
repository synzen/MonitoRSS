process.env.TEST_ENV = true
const Discord = require('discord.js')
const ArticleMessage = require('../../structs/ArticleMessage.js')
const Article = require('../../structs/Article.js')

jest.mock('discord.js')
jest.mock('../../structs/Article.js')

describe('Unit::ArticleMessage', function () {
  const baseFeedData = {
    feed: {}
  }
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('constructor', function () {
    const baseArticle = {}
    it('defines the correct properties for this.parsedArticle', function () {
      const parsedArticle = {
        foo: 'barbara'
      }
      Article.mockImplementationOnce(() => parsedArticle)
      const feedData = {
        foo: 'baz',
        feed: 'boobaz',
        filteredFormats: 'asrfdeuj'
      }
      const debug = true
      const m = new ArticleMessage(baseArticle, feedData, debug)
      expect(m.article).toEqual(baseArticle)
      expect(m.feed).toEqual(feedData.feed)
      expect(m.filteredFormats).toEqual(feedData.filteredFormats)
      expect(m.parsedArticle).toEqual(parsedArticle)
      expect(m.debug).toEqual(debug)
    })
  })
  describe('passedFilters', function () {
    it('returns the tested filters for regex if it exists', function () {
      const feedData = {
        feed: {
          rfilters: {
            title: 'myregex'
          }
        }
      }
      const testFilters = jest.fn()
        .mockReturnValue({
          passed: 'what is here'
        })
      const parsedArticle = {
        testFilters
      }
      const m = new ArticleMessage({}, feedData)
      m.parsedArticle = parsedArticle
      expect(m.passedFilters()).toEqual('what is here')
      expect(testFilters).toHaveBeenCalledWith(feedData.feed.rfilters)
    })
    it('returns the tested filters for non-regex if regex does not exist', function () {
      const feedData = {
        feed: {
          filters: {
            title: ['a', 'b']
          },
          rfilters: {}
        }
      }
      const testFilters = jest.fn()
        .mockReturnValue({
          passed: 'water'
        })
      const parsedArticle = {
        testFilters
      }
      const m = new ArticleMessage({}, feedData)
      m.parsedArticle = parsedArticle
      expect(m.passedFilters()).toEqual('water')
      expect(testFilters).toHaveBeenCalledWith(feedData.feed.filters)
    })
  })
  describe('getWebhookNameAvatar', function () {
    it('returns default name if no custom settings', function () {
      const webhook = {
        name: 'abc'
      }
      const feedData = {
        ...baseFeedData,
        feed: {
          webhook: {}
        }
      }
      const m = new ArticleMessage({}, feedData)
      expect(m.getWebhookNameAvatar(webhook))
        .toEqual({
          username: webhook.name
        })
    })
    it('returns the custom name if it exists', function () {
      const webhook = {
        name: 'abc'
      }
      const feedData = {
        ...baseFeedData,
        feed: {
          webhook: {
            name: 'bqa wsedtgrf'
          }
        }
      }
      const customName = 'we4r5ytu6j546ut7ryji5e6rr7irkmkw34ry54'
      const m = new ArticleMessage({}, feedData)
      m.parsedArticle = {
        convertKeywords: () => customName
      }
      expect(m.getWebhookNameAvatar(webhook))
        .toEqual({
          username: customName.slice(0, 32)
        })
    })
    it('returns the custom avatar if it exists', function () {
      const webhook = {
        name: 'abc'
      }
      const feedData = {
        ...baseFeedData,
        feed: {
          webhook: {
            avatar: 'my avatar {placeholders}'
          }
        }
      }
      const customAvatar = 'we4r5ytu6j546ut7ryji5e6rr7irkmkw34ry54'
      const m = new ArticleMessage({}, feedData)
      m.parsedArticle = {
        convertImgs: () => customAvatar
      }
      expect(m.getWebhookNameAvatar(webhook))
        .toEqual({
          username: webhook.name,
          avatarURL: customAvatar
        })
    })
  })
  describe('send()', function () {
    const rawArticle = {
      _feed: {
        filters: {},
        rfilters: {},
        filteredFormats: [],
        embeds: []
      }
    }
    let medium
    beforeEach(function () {
      const generatedMessage = { text: 'awszf', embeds: [1, 2] }
      medium = {
        send: jest.fn()
      }
      jest.spyOn(ArticleMessage.prototype, 'getWebhook')
        .mockImplementation()
      jest.spyOn(ArticleMessage.prototype, 'createTextAndOptions')
        .mockImplementation(() => generatedMessage)
      jest.spyOn(ArticleMessage.prototype, 'getMedium')
        .mockReturnValue(medium)
      jest.spyOn(ArticleMessage.prototype, 'passedFilters')
        .mockReturnValue(true)
      jest.spyOn(ArticleMessage.prototype, 'generateMessage')
        .mockReturnValue({})
    })
    afterEach(function () {
      jest.restoreAllMocks()
    })
    it('throws an error if missing channel', function () {
      const m = new ArticleMessage(rawArticle, baseFeedData)
      jest.spyOn(m, 'getMedium')
        .mockResolvedValue()
      return expect(m.send()).rejects.toBeInstanceOf(Error)
    })
    it('throws the same error that channel.send throws ', async function () {
      const m = new ArticleMessage(rawArticle, baseFeedData)
      const error = new Error('hello world')
      error.code = 5555
      medium.send.mockRejectedValue(error)
      await expect(m.send()).rejects.toThrow(error)
    })
    it('does not retry if errorCode is 50013', async function () {
      const m = new ArticleMessage(rawArticle, baseFeedData)
      const error = new Error('hello world')
      error.code = 50013
      medium.send.mockRejectedValue(error)
      await expect(m.send()).rejects.toThrow(Error)
      expect(medium.send).toHaveBeenCalledTimes(1)
    })
    it('retries a maximum of 4 times with an unrecognized error', async function () {
      const m = new ArticleMessage(rawArticle, baseFeedData)
      const error = new Error('hello world')
      medium.send.mockRejectedValue(error)
      await expect(m.send()).rejects.toThrow(Error)
      expect(medium.send).toHaveBeenCalledTimes(4)
    })
  })
  describe('createOptions', function () {
    const rawArticle = {}
    beforeEach(function () {
      jest.spyOn(ArticleMessage.prototype, 'getWebhookNameAvatar')
        .mockReturnValue({})
    })
    it('parses roles, users, everyone', function () {
      const m = new ArticleMessage(rawArticle, baseFeedData)
      const embeds = []
      const options = m.createOptions(embeds)
      expect(options.allowedMentions.parse)
        .toEqual(expect.arrayContaining(['roles', 'users', 'everyone']))
    })
    it('sets the username and avatar URL if the medium is a webhook', function () {
      const m = new ArticleMessage(rawArticle, baseFeedData)
      const webhookSettings = {
        username: 'fooby',
        avatarURL: 'urlhere'
      }
      jest.spyOn(m, 'getWebhookNameAvatar')
        .mockReturnValue(webhookSettings)
      const webhook = new Discord.Webhook()
      const options = m.createOptions([], webhook)
      expect(options.username).toEqual(webhookSettings.username)
      expect(options.avatarURL).toEqual(webhookSettings.avatarURL)
    })
    it('returns the first embed in a list of embeds if there is no webhook', function () {
      const m = new ArticleMessage(rawArticle, baseFeedData)
      const embeds = [1, 2, 3]
      const data = m.createOptions(embeds)
      expect(data.embed).toEqual(embeds[0])
      expect(data.embeds).toBeUndefined()
    })
    it('returns all the embeds in a list there is a webhook', function () {
      const m = new ArticleMessage(rawArticle, baseFeedData)
      const embeds = [1, 2, 3]
      const webhook = new Discord.Webhook()
      const data = m.createOptions(embeds, webhook)
      expect(data.embed).toBeUndefined()
      expect(data.embeds).toEqual(embeds)
    })
    it('attaches user split options for non-test-message', function () {
      const feedData = {
        ...baseFeedData,
        feed: {
          split: {
            a: 'b'
          }
        }
      }
      const m = new ArticleMessage(rawArticle, feedData)
      const data = m.createOptions([])
      expect(data.split).toEqual(feedData.feed.split)
    })
  })
  describe('createAPIPayloads', function () {
    it('returns one payload for content with <2000 characters', () => {
      const mockAPIPayload = {
        foo: 'bar',
        content: 'hello world'
      }
      jest.spyOn(ArticleMessage.prototype, 'createAPIPayload')
        .mockReturnValue(mockAPIPayload)
      const m = new ArticleMessage({}, baseFeedData)
      expect(m.createAPIPayloads())
        .toEqual([mockAPIPayload])
    })
    it('returns one payload if split is disabled when content is >= 20000 characters', () => {
      const mockAPIPayload = {
        foo: 'bar',
        content: ''.padEnd(2100)
      }
      jest.spyOn(ArticleMessage.prototype, 'createAPIPayload')
        .mockReturnValue(mockAPIPayload)
      const m = new ArticleMessage({}, baseFeedData)
      expect(m.createAPIPayloads())
        .toEqual([mockAPIPayload])
    })
    it('it attaches the first embed to the last message after split for non-webhook', () => {
      const mockAPIPayload = {
        foo: 'bar',
        content: ''.padEnd(2001, 'b'),
        split: {
          maxLength: 2000,
          char: '\n',
          prepend: '',
          append: ''
        },
        embed: { foo: 1 }
      }
      Discord.Util.splitMessage.mockReturnValue(['a', 'b'])
      jest.spyOn(ArticleMessage.prototype, 'createAPIPayload')
        .mockReturnValue(mockAPIPayload)
      const m = new ArticleMessage({}, baseFeedData)
      const payloads = m.createAPIPayloads()
      expect(payloads).toHaveLength(2)
      expect(payloads[1]).toEqual(expect.objectContaining({
        foo: 'bar',
        content: 'b',
        embed: { foo: 1 }
      }))
    })
    it('it attaches the embeds to the last message after split for webhooks', () => {
      const mockAPIPayload = {
        foo: 'bar',
        content: ''.padEnd(2001, 'b'),
        split: {
          maxLength: 2000,
          char: '\n',
          prepend: '',
          append: ''
        },
        embeds: [{ foo: 1 }, { foo: 2 }]
      }
      const webhook = new Discord.Webhook({})
      Discord.Util.splitMessage.mockReturnValue(['a', 'b'])
      jest.spyOn(ArticleMessage.prototype, 'createAPIPayload')
        .mockReturnValue(mockAPIPayload)
      const m = new ArticleMessage({}, baseFeedData)
      const payloads = m.createAPIPayloads(webhook)
      expect(payloads).toHaveLength(2)
      expect(payloads[1]).toEqual(expect.objectContaining({
        foo: 'bar',
        content: 'b',
        embeds: mockAPIPayload.embeds
      }))
    })
  })
  describe('createTextAndOptions', function () {
    beforeEach(function () {
      jest.spyOn(ArticleMessage.prototype, 'generateMessage')
        .mockReturnValue({})
      jest.spyOn(ArticleMessage.prototype, 'createOptions')
        .mockImplementation()
    })
    it('returns text and options', function () {
      const m = new ArticleMessage({}, baseFeedData)
      const data = m.createTextAndOptions()
      expect(data).toHaveProperty('text')
      expect(data).toHaveProperty('options')
    })
  })
})
