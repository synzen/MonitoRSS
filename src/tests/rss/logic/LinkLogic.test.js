const LinkLogic = require('../../../rss/logic/LinkLogic.js')
const ArticleIDResolver = require('../../../structs/ArticleIDResolver.js')
const dbCmds = require('../../../rss/db/commands.js')

const DEFAULT_DATA = { config: { feeds: {} } }

jest.mock('moment', () => {
  const func = () => ({ subtract: jest.fn() })
  func.tz = { zone: jest.fn() }
  func.locale = jest.fn()
  func.locales = jest.fn(() => [])
  return func
})
jest.mock('moment-timezone', () => {
  const func = () => ({ subtract: jest.fn() })
  func.tz = { zone: jest.fn() }
  func.locale = jest.fn()
  func.locales = jest.fn(() => [])
  return func
})
jest.mock('../../../structs/Article.js')
jest.mock('../../../rss/db/commands.js')
jest.mock('../../../util/logger.js')
jest.mock('../../../config.js')
jest.mock('../../../structs/ArticleIDResolver.js')

describe('Unit::LinkLogic', function () {
  describe('run()', function () {
    it('throws an error if no scheduleName is defined', function () {
      const logic = new LinkLogic(DEFAULT_DATA)
      return expect(logic.run()).rejects.toEqual(expect.objectContaining({ message: expect.stringContaining('schedule') }))
    })
  })
  describe('getDataFromDocuments()', function () {
    it('adds ids to this.dbIDs', async function () {
      const logic = new LinkLogic(DEFAULT_DATA)
      const resolvedDocuments = [{ id: 'abc' }, { id: 'def' }]
      dbCmds.findAll.mockResolvedValueOnce(resolvedDocuments)
      await logic.getDataFromDocuments()
      for (const doc of resolvedDocuments) {
        expect(logic.dbIDs.has(doc.id)).toEqual(true)
      }
    })
    it('adds titles to this.dbTitles', async function () {
      const logic = new LinkLogic(DEFAULT_DATA)
      const resolvedDocuments = [{ title: 'abc' }, { title: 'def' }]
      dbCmds.findAll.mockResolvedValueOnce(resolvedDocuments)
      await logic.getDataFromDocuments()
      for (const doc of resolvedDocuments) {
        expect(logic.dbTitles.has(doc.title)).toEqual(true)
      }
    })
    it('adds the custom comparison values to this.dbCustomComparisons', async function () {
      const logic = new LinkLogic(DEFAULT_DATA)
      const resolvedDocuments = [{ customComparisons: { placeholder: ['c', 'd'] } }, { customComparisons: { title: ['a', 'b'] } }]
      dbCmds.findAll.mockResolvedValueOnce(resolvedDocuments)
      await logic.getDataFromDocuments()
      for (const doc of resolvedDocuments) {
        const comparisons = doc.customComparisons
        for (const comparisonName in comparisons) {
          const values = comparisons[comparisonName]
          for (const val of values) {
            expect(logic.dbCustomComparisons[comparisonName].has(val)).toEqual(true)
          }
        }
      }
    })
  })
  describe('articleListTasks()', function () {
    afterEach(function () {
      dbCmds.bulkInsert.mockReset()
    })
    it('attaches the _id property to all articles', async function () {
      const articleList = [{}, {}]
      const logic = new LinkLogic({ ...DEFAULT_DATA, articleList })
      ArticleIDResolver.getIDTypeValue
        .mockReturnValueOnce('a')
        .mockReturnValueOnce('b')
      await logic.articleListTasks()
      expect(articleList[0]._id).toEqual('a')
      expect(articleList[1]._id).toEqual('b')
    })
    it('adds invalid comparisons to this.dbCustomComparisonsToDelete', async function () {
      const articleList = [{ invalid1: new Date(), invalid2: null, valid1: 'hello' }, { invalid1: 1, invalid2: 'aha', invalid3: 'hello world', valid1: 'world' }]
      const logic = new LinkLogic({ ...DEFAULT_DATA, articleList })
      logic.dbCustomComparisons.invalid1 = new Set()
      logic.dbCustomComparisons.invalid2 = new Set()
      logic.dbCustomComparisons.invalid3 = new Set()
      logic.dbCustomComparisons.valid1 = new Set()
      await logic.articleListTasks()
      expect(logic.dbCustomComparisonsToDelete.has('invalid1')).toEqual(true)
      expect(logic.dbCustomComparisonsToDelete.has('invalid2')).toEqual(true)
      expect(logic.dbCustomComparisonsToDelete.has('invalid3')).toEqual(true)
      expect(logic.dbCustomComparisonsToDelete.has('valid1')).toEqual(false)
    })
    it('calls bulkInsert with the new articles', async function () {
      const articleList = [{}, {}, {}]
      const logic = new LinkLogic({ ...DEFAULT_DATA, articleList })
      ArticleIDResolver.getIDTypeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(3)
      logic.dbIDs.add(1)
      logic.dbIDs.add(3)
      const collection = { do: 'ho' }
      await logic.articleListTasks(collection)
      expect(dbCmds.bulkInsert).toHaveBeenCalledWith(collection, [articleList[1]])
    })
  })
  describe('static formatArticle()', function () {
    it('attaches the rssName and source', function () {
      const article = { dink: 2 }
      const source = { donk: 1 }
      const rssName = 'abc!'
      LinkLogic.formatArticle(article, source, rssName)
      expect(article._delivery.source).toEqual(source)
      expect(article._delivery.rssName).toEqual(rssName)
    })
  })
})
