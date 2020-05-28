const ArticleRateLimiter = require('../../structs/ArticleMessageRateLimiter.js')
const config = require('../../config.js')

jest.mock('../../config.js')

describe('create', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ArticleRateLimiter.limiters = new Map()
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })
  describe('hasLimiter', () => {
    it('returns correctly', () => {
      const channelID = 'w4rte36y5'
      ArticleRateLimiter.limiters.set(channelID, 1)
      expect(ArticleRateLimiter.hasLimiter(channelID))
        .toEqual(true)
      expect(ArticleRateLimiter.hasLimiter(channelID + 'b'))
        .toEqual(false)
    })
  })
  describe('getLimiter', () => {
    it('returns the limiter if it exists', function () {
      const channelID = 'w34r6te5y'
      const limiter = {
        foo: 'bar'
      }
      ArticleRateLimiter.limiters.set(channelID, limiter)
      expect(ArticleRateLimiter.getLimiter(channelID))
        .toEqual(limiter)
    })
    it('returns a created limiter if it does not exist', () => {
      const channelID = 'w43y6yhy'
      const limiter = {
        foo: 'baz'
      }
      jest.spyOn(ArticleRateLimiter, 'create')
        .mockReturnValue(limiter)
      expect(ArticleRateLimiter.getLimiter(channelID))
        .toEqual(limiter)
    })
  })
  describe('enqueue', () => {
    it('sends the article', async () => {
      const articleMessage = {
        getChannel: () => ({})
      }
      const limiter = {
        isAtLimit: () => false,
        send: jest.fn()
      }
      jest.spyOn(ArticleRateLimiter, 'getLimiter')
        .mockReturnValue(limiter)
      await ArticleRateLimiter.enqueue(articleMessage)
      expect(limiter.send).toHaveBeenCalledTimes(1)
    })
    it('does not send the article if no channel', async () => {
      const articleMessage = {
        getChannel: () => null
      }
      const limiter = {
        isAtLimit: () => false,
        send: jest.fn()
      }
      jest.spyOn(ArticleRateLimiter, 'getLimiter')
        .mockReturnValue(limiter)
      await ArticleRateLimiter.enqueue(articleMessage)
      expect(limiter.send).not.toHaveBeenCalled()
    })
    it('rejects if rate limited', async () => {
      const articleMessage = {
        getChannel: () => ({})
      }
      const limiter = {
        isAtLimit: () => true,
        send: jest.fn()
      }
      jest.spyOn(ArticleRateLimiter, 'getLimiter')
        .mockReturnValue(limiter)
      await expect(ArticleRateLimiter.enqueue(articleMessage))
        .rejects.toThrow(Error)
    })
  })
  describe('isAtLimit', () => {
    beforeEach(() => {
      config.get.mockReturnValue({
        feeds: {}
      })
    })
    it('returns false if no article limit', () => {
      const limiter = new ArticleRateLimiter()
      limiter.articlesLimit = 0
      expect(limiter.isAtLimit()).toEqual(false)
    })
    it('returns true if articles remaining is 0', () => {
      const limiter = new ArticleRateLimiter()
      limiter.articlesLimit = 99
      limiter.articlesRemaining = 0
      expect(limiter.isAtLimit()).toEqual(true)
    })
    it('returns false if there are articles remaining', () => {
      const limiter = new ArticleRateLimiter()
      limiter.articlesLimit = 99
      limiter.articlesRemaining = 1
      expect(limiter.isAtLimit()).toEqual(false)
    })
  })
  describe('constructor', () => {
    const configRefreshRate = 4536745
    const configArticlesLimit = 436745
    beforeEach(() => {
      config.get.mockReturnValue({
        feeds: {
          refreshRateMinutes: configRefreshRate,
          articleRateLimit: configArticlesLimit
        }
      })
    })
    it('sets the relevant properties', () => {
      const channelID = '34wr6te5y'
      const limiter = new ArticleRateLimiter(channelID)
      expect(limiter.channelID).toEqual(channelID)
      expect(limiter.articlesLimit).toEqual(configArticlesLimit)
      expect(limiter.articlesRemaining).toEqual(configArticlesLimit)
    })
    it('creates the timer', () => {
      // eslint-disable-next-line no-unused-vars
      const limiter = new ArticleRateLimiter()
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000 * 60 * configRefreshRate)
    })
  })
})
