process.env.TEST_ENV = true
const Discord = require('discord.js')
const ArticleMessage = require('../../structs/ArticleMessage.js')
const Article = require('../../structs/Article.js')

jest.mock('discord.js')
jest.mock('../../structs/Article.js')

const Bot = () => ({
  shard: {
    ids: []
  },
  channels: {
    cache: {
      get: jest.fn()
    }
  }
})

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
      const bot = Bot()
      const feedData = {
        foo: 'baz',
        feed: 'boobaz',
        filteredFormats: 'asrfdeuj'
      }
      const debug = true
      const m = new ArticleMessage(bot, baseArticle, feedData, debug)
      expect(m.bot).toEqual(bot)
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
      const m = new ArticleMessage(Bot(), {}, feedData)
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
      const m = new ArticleMessage(Bot(), {}, feedData)
      m.parsedArticle = parsedArticle
      expect(m.passedFilters()).toEqual('water')
      expect(testFilters).toHaveBeenCalledWith(feedData.feed.filters)
    })
  })
  describe('getWebhookNameAvatar', function () {
    it('returns default name and avatar if no custom settings', function () {
      const avatarURL = 'ews4r357ytur'
      const webhook = {
        name: 'abc',
        avatarURL: () => avatarURL
      }
      const feedData = {
        ...baseFeedData,
        feed: {
          webhook: {}
        }
      }
      const m = new ArticleMessage(Bot(), {}, feedData)
      expect(m.getWebhookNameAvatar(webhook))
        .toEqual({
          username: webhook.name,
          avatarURL
        })
    })
    it('returns the custom name if it exists', function () {
      const avatarURL = 'ews4r357ytur'
      const webhook = {
        name: 'abc',
        avatarURL: () => avatarURL
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
      const m = new ArticleMessage(Bot(), {}, feedData)
      m.parsedArticle = {
        convertKeywords: () => customName
      }
      expect(m.getWebhookNameAvatar(webhook))
        .toEqual({
          username: customName.slice(0, 32),
          avatarURL
        })
    })
    it('returns the custom avatar if it exists', function () {
      const avatarURL = 'ews4r357ytur'
      const webhook = {
        name: 'abc',
        avatarURL: () => avatarURL
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
      const m = new ArticleMessage(Bot(), {}, feedData)
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
      jest.spyOn(ArticleMessage.prototype, 'createOptions')
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
      const bot = Bot()
      const m = new ArticleMessage(bot, rawArticle, baseFeedData)
      jest.spyOn(m, 'getMedium')
        .mockResolvedValue()
      return expect(m.send()).rejects.toBeInstanceOf(Error)
    })
    it('does not send the article if it did not pass filters', async function () {
      const bot = Bot()
      const m = new ArticleMessage(bot, rawArticle, baseFeedData)
      jest.spyOn(m, 'passedFilters')
        .mockReturnValue(false)
      await m.send()
      expect(medium.send).not.toHaveBeenCalled()
    })
    it('throws the same error that channel.send throws ', async function () {
      const bot = Bot()
      const m = new ArticleMessage(bot, rawArticle, baseFeedData)
      const error = new Error('hello world')
      error.code = 5555
      medium.send.mockRejectedValue(error)
      await expect(m.send()).rejects.toThrow(error)
    })
    it('does not retry if errorCode is 50013', async function () {
      const m = new ArticleMessage(Bot(), rawArticle, baseFeedData)
      const error = new Error('hello world')
      error.code = 50013
      medium.send.mockRejectedValue(error)
      await expect(m.send()).rejects.toThrow(Error)
      expect(medium.send).toHaveBeenCalledTimes(1)
    })
    it('retries a maximum of 4 times with an unrecognized error', async function () {
      const m = new ArticleMessage(Bot(), rawArticle, baseFeedData)
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
      const m = new ArticleMessage(Bot(), rawArticle, baseFeedData)
      const embeds = []
      const options = m.createOptions(embeds)
      expect(options.allowedMentions.parse)
        .toEqual(expect.arrayContaining(['roles', 'users', 'everyone']))
    })
    it('sets the username and avatar URL if the medium is a webhook', function () {
      const m = new ArticleMessage(Bot(), rawArticle, baseFeedData)
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
      const m = new ArticleMessage(Bot(), rawArticle, baseFeedData)
      const embeds = [1, 2, 3]
      const data = m.createOptions(embeds)
      expect(data.embed).toEqual(embeds[0])
      expect(data.embeds).toBeUndefined()
    })
    it('returns all the embeds in a list there is a webhook', function () {
      const m = new ArticleMessage(Bot(), rawArticle, baseFeedData)
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
      const m = new ArticleMessage(Bot(), rawArticle, feedData)
      const data = m.createOptions([])
      expect(data.split).toEqual(feedData.feed.split)
    })
  })
})
