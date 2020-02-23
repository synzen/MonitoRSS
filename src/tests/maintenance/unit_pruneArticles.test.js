process.env.TEST_ENV = true
const Feed = require('../../structs/db/Feed.js')
const Article = require('../../models/Article.js')
const pruneArticles = require('../../maintenance/pruneArticles.js')

jest.mock('../../config.json')
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
  return article.shardID + article.scheduleName + article.feedURL
}

describe('utils/maintenance/pruneArticles', function () {
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
        shardID: 1,
        scheduleName: 'default',
        feedURL: 'url1',
        remove: jest.fn()
      }, {
        shardID: 0,
        scheduleName: 'vip',
        feedURL: 'url1',
        remove: jest.fn()
      }, {
        shardID: 1,
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
      const guildIdsByShard = new Map([
        ['1', 5],
        ['2', 7],
        ['3', 9]
      ])
      const ids = await pruneArticles.getCompoundIDs(guildIdsByShard)
      expect(ids).toContain('5defaultfeedurl1')
      expect(ids).toContain('7feed43feedurl2')
      expect(ids).toContain('5defaultfeedurl3')
      expect(ids.size).toEqual(3)
    })
    it('does not add ids for unknown guilds', async function () {
      const assignedSchedules = [{
        name: 'default'
      }, {
        name: 'feed43'
      }, {
        name: 'default'
      }]
      const feeds = [{
        url: 'feedurl1',
        guild: '1', // This guild is unknown
        determineSchedule: jest.fn(() => assignedSchedules[0])
      }, {
        url: 'feedurl2',
        guild: '2',
        determineSchedule: jest.fn(() => assignedSchedules[1])
      }, {
        url: 'feedurl3',
        guild: '1', // This guild is unknown
        determineSchedule: jest.fn(() => assignedSchedules[2])
      }]
      Feed.getAll.mockResolvedValue(feeds)
      const guildIdsByShard = new Map([
        ['2', 7],
        ['3', 9]
      ])
      const ids = await pruneArticles.getCompoundIDs(guildIdsByShard)
      expect(ids).toContain('7feed43feedurl2')
      expect(ids.size).toEqual(1)
    })
  })
})
