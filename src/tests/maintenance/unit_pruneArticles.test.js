process.env.TEST_ENV = true
const Feed = require('../../structs/db/Feed.js')
const Article = require('../../models/Article.js')
const pruneArticles = require('../../maintenance/pruneArticles.js')

jest.mock('../../config.js')
jest.mock('../../structs/db/Feed.js')
jest.mock('../../structs/db/Supporter.js')
jest.mock('../../structs/db/Schedule.js')
jest.mock('../../models/Article.js', () => ({
  model: {
    find: jest.fn(() => ({
      exec: jest.fn(() => [])
    }))
  }
}))

const createCompoundID = (article) => {
  return article.scheduleName + article.feedURL
}

describe('Unit::maintenance/pruneArticles', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  describe('pruneArticles', function () {
    beforeEach(function () {
      Feed.isMongoDatabase = true
      jest.spyOn(pruneArticles, 'getCompoundIDs')
        .mockReturnValue()
    })
    it('returns -1 if not mongo database or config clean is false', async function () {
      Feed.isMongoDatabase = false
      await expect(pruneArticles.pruneArticles()).resolves.toEqual(-1)
    })
    it('removes the right articles with compound IDs', async function () {
      const articles = [{
        scheduleName: 'default',
        feedURL: 'url1',
        remove: jest.fn()
      }, {
        scheduleName: 'vip',
        feedURL: 'url1',
        remove: jest.fn()
      }, {
        scheduleName: 'default',
        feedURL: 'url2',
        remove: jest.fn()
      }]
      const compoundIDs = new Set([createCompoundID(articles[1])])
      jest.spyOn(pruneArticles, 'getCompoundIDs')
        .mockResolvedValue(compoundIDs)
      Article.model.find.mockReturnValue({
        exec: jest.fn(() => articles)
      })
      await pruneArticles.pruneArticles()
      expect(articles[0].remove).toHaveBeenCalled()
      expect(articles[1].remove).not.toHaveBeenCalled()
      expect(articles[2].remove).toHaveBeenCalled()
    })
  })
  describe('getCompoundID', function () {
    // Compound IDs are shard + schedule + feed URL
    it('returns the compound ids', async function () {
      const assignedSchedules = [{
        name: 'default'
      }, {
        name: 'feed43'
      }, {
        name: 'default'
      }]
      const feeds = [{
        url: 'feedurl1',
        guild: '1',
        determineSchedule: jest.fn(() => assignedSchedules[0])
      }, {
        url: 'feedurl2',
        guild: '2',
        determineSchedule: jest.fn(() => assignedSchedules[1])
      }, {
        url: 'feedurl3',
        guild: '1',
        determineSchedule: jest.fn(() => assignedSchedules[2])
      }]
      Feed.getAll.mockResolvedValue(feeds)
      const ids = await pruneArticles.getCompoundIDs()
      expect(ids).toContain('defaultfeedurl1')
      expect(ids).toContain('feed43feedurl2')
      expect(ids).toContain('defaultfeedurl3')
      expect(ids.size).toEqual(3)
    })
  })
})
