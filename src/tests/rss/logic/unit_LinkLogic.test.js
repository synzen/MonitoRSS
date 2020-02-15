const LinkLogic = require('../../../rss/logic/LinkLogic.js')
const ArticleIDResolver = require('../../../structs/ArticleIDResolver.js')
const dbCmds = require('../../../rss/db/commands.js')

const DEFAULT_DATA = { config: { feeds: {} } }

jest.mock('../../../rss/db/commands.js')
jest.mock('../../../util/logger.js')
jest.mock('../../../config.js')
jest.mock('../../../structs/ArticleIDResolver.js')
jest.mock('../../../models/Article.js')

describe('Unit::LinkLogic', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
  })
  describe('getComparisonReferences', function () {
    it('returns a map', function () {
      const result = LinkLogic.getComparisonReferences([])
      expect(result).toBeInstanceOf(Map)
    })
    it('returns all stored properties', function () {
      const docs = [{
        properties: {
          title: 't1',
          description: 'd1'
        }
      }, {
        properties: {
          title: 't2'
        }
      }]
      const result = LinkLogic.getComparisonReferences(docs)
      expect(result.get('title')).toEqual(new Set(['t1', 't2']))
      expect(result.get('description')).toEqual(new Set(['d1']))
    })
  })
  describe('formatArticle', function () {
    it('returns correctly', function () {
      const article = {
        a: 1,
        b: 2
      }
      const feed = {
        a: 6
      }
      expect(LinkLogic.formatArticle(article, feed)).toEqual({
        ...article,
        _feed: feed
      })
    })
  })
  describe('positiveComparisonPasses', function () {
    it('returns false for no comparisons', function () {
      const result = LinkLogic.positiveComparisonPasses({}, [], new Map(), new Map())
      expect(result).toEqual(false)
    })
    it('returns true for unstored property', function () {
      const dbReferences = new Map()
      dbReferences.set('title', new Set(['t1']))
      dbReferences.set('description', new Set(['d1']))
      const article = {
        title: 't1',
        description: 'd2'
      }
      const result = LinkLogic.positiveComparisonPasses(
        article,
        ['title', 'description'],
        dbReferences,
        new Map())
      expect(result).toEqual(true)
    })
    it('returns false for all stored properties', function () {
      const dbReferences = new Map()
      dbReferences.set('title', new Set(['t1']))
      dbReferences.set('description', new Set(['d1']))
      const article = {
        title: 't1',
        description: 'd1'
      }
      const result = LinkLogic.positiveComparisonPasses(
        article,
        ['title', 'description'],
        dbReferences,
        new Map())
      expect(result).toEqual(false)
    })
    it('returns false for uninitialized properties', function () {
      /**
       * Returns false because other title values must be
       * stored to show this was initialized. Uninitialized
       * pcomparison properties will cause every article in
       * the feed to be sent since every value would technically
       * be new for a newly added pcomparison.
       */
      const article = {
        title: 't1'
      }
      const result = LinkLogic.positiveComparisonPasses(
        article,
        ['title'],
        new Map(),
        new Map())
      expect(result).toEqual(false)
    })
    it('returns false for cached property', function () {
      const sentRefs = new Map()
      sentRefs.set('title', new Set(['t1']))
      sentRefs.set('description', new Set(['d1']))
      const dbReferences = new Map()
      dbReferences.set('title', new Set(['srfdht']))
      dbReferences.set('description', new Set(['srfdhredht']))
      const article = {
        title: 't1',
        description: 'd1'
      }
      const result = LinkLogic.positiveComparisonPasses(
        article,
        ['title', 'description'],
        dbReferences,
        sentRefs)
      expect(result).toEqual(false)
    })
  })
  describe('negativeComparisonBlocks', function () {
    it('returns false for no comparisons', function () {
      const result = LinkLogic.negativeComparisonBlocks({}, [], new Map(), new Map())
      expect(result).toEqual(false)
    })
    it('returns true for unstored property', function () {
      const dbReferences = new Map()
      dbReferences.set('description', new Set(['d1']))
      const article = {
        description: 'd2'
      }
      const result = LinkLogic.negativeComparisonBlocks(
        article,
        ['title', 'description'],
        dbReferences,
        new Map())
      expect(result).toEqual(false)
    })
    it('returns true for one stored properties', function () {
      const dbReferences = new Map()
      dbReferences.set('description', new Set(['d1']))
      const article = {
        title: 't1',
        description: 'd1'
      }
      const result = LinkLogic.negativeComparisonBlocks(
        article,
        ['title', 'description'],
        dbReferences,
        new Map())
      expect(result).toEqual(true)
    })
    it('returns true for a cached property', function () {
      const sentRefs = new Map()
      sentRefs.set('title', new Set(['t1']))
      const article = {
        title: 't1',
        description: 'd1'
      }
      const result = LinkLogic.negativeComparisonBlocks(
        article,
        ['title', 'description'],
        new Map(),
        sentRefs)
      expect(result).toEqual(true)
    })
  })
  describe('isNewArticle', function () {
    beforeEach(function () {
      jest.spyOn(LinkLogic.prototype, 'storePropertiesToBuffer')
        .mockReturnValue()
    })
    describe('id is not in database', function () {
      const dbIDs = new Set(['b'])
      const article = {
        _id: 'a'
      }
      it('returns true with no blocked comparisons', function () {
        jest.spyOn(LinkLogic, 'negativeComparisonBlocks')
          .mockReturnValue(false)
        const logic = new LinkLogic({ ...DEFAULT_DATA })
        expect(logic.isNewArticle(dbIDs, article, {}, false, new Map()))
          .toEqual(true)
      })
      it('returns false with blocked comaprisons', function () {
        jest.spyOn(LinkLogic, 'negativeComparisonBlocks')
          .mockReturnValue(true)
        const logic = new LinkLogic({ ...DEFAULT_DATA })
        expect(logic.isNewArticle(dbIDs, article, {}, false, new Map()))
          .toEqual(false)
      })
    })
    describe('id is in database', function () {
      const dbIDs = new Set(['a'])
      const article = {
        _id: 'a'
      }
      it('returns false with no passed comparisons', function () {
        jest.spyOn(LinkLogic, 'positiveComparisonPasses')
          .mockReturnValue(false)
        const logic = new LinkLogic({ ...DEFAULT_DATA })
        expect(logic.isNewArticle(dbIDs, article, {}, false, new Map()))
          .toEqual(false)
      })
      it('returns true with passed comparisons', function () {
        jest.spyOn(LinkLogic, 'positiveComparisonPasses')
          .mockReturnValue(true)
        const logic = new LinkLogic({ ...DEFAULT_DATA })
        expect(logic.isNewArticle(dbIDs, article, {}, false, new Map()))
          .toEqual(true)
      })
    })
    describe('date checks for any article that sends', function () {
      const dbIDs = new Set(['b'])
      const article = {
        _id: 'a'
      }
      beforeEach(function () {
        jest.spyOn(LinkLogic, 'negativeComparisonBlocks')
          .mockReturnValue(false)
      })
      it('does not send if no article date', function () {
        const logic = new LinkLogic({ ...DEFAULT_DATA })
        expect(logic.isNewArticle(dbIDs, article, {}, true, new Map()))
          .toEqual(false)
      })
      it('does not send if article has invalid date', function () {
        const invalidDateArticle = {
          ...article,
          pubdate: new Date('invalid date')
        }
        const logic = new LinkLogic({ ...DEFAULT_DATA })
        expect(logic.isNewArticle(dbIDs, invalidDateArticle, {}, true, new Map()))
          .toEqual(false)
      })
      it('sends for recent article with valid date', function () {
        const validDateArticle = {
          ...article,
          pubdate: new Date()
        }
        const logic = new LinkLogic({ ...DEFAULT_DATA })
        expect(logic.isNewArticle(dbIDs, validDateArticle, {}, true, new Map()))
          .toEqual(true)
      })
      it('does not send for old date', function () {
        const logicData = {
          config: {
            feeds: {
              cycleMaxAge: 2
            }
          }
        }
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 10)
        const oldArticle = {
          ...article,
          pubdate: oldDate
        }
        const logic = new LinkLogic({ ...logicData })
        expect(logic.isNewArticle(dbIDs, oldArticle, {}, true, new Map()))
          .toEqual(false)
      })
    })
  })
  describe('static formatArticleForDatabase', function () {
    afterEach(function () {
      ArticleIDResolver.getIDTypeValue.mockRestore()
    })
    it('attaches the critical values', function () {
      const resolvedID = 'qe3wtsrg'
      ArticleIDResolver.getIDTypeValue
        .mockReturnValue(resolvedID)
      const meta = {
        feedURL: 'abc',
        shardID: 2,
        scheduleName: 'ewstg'
      }
      const formatted = LinkLogic.formatArticleForDatabase({}, [], '', meta)
      expect(formatted).toEqual(expect.objectContaining({
        _id: resolvedID,
        ...meta
      }))
    })
    it('attaches properties', function () {
      const article = {
        title: 't1',
        description: 'd1',
        summary: 'abc',
        date: new Date(),
        author: null
      }
      const properties = ['title', 'description', 'date', 'author']
      const formatted = LinkLogic.formatArticleForDatabase(article, properties, '', {})
      expect(formatted.properties).toEqual({
        title: article.title,
        description: article.description
      })
    })
  })
  describe('updatedDocumentForDatabase', function () {
    beforeEach(function () {
      jest.spyOn(LinkLogic, 'prunedDocumentForDatabase')
        .mockReturnValue(false)
    })
    it('adds new properties when applicable', function () {
      const article = {
        title: 't1',
        description: 'd1',
        summary: 's1',
        date: new Date(),
        author: null
      }
      const document = {
        properties: {
          title: 't1'
        }
      }
      const properties = ['title', 'description', 'date', 'author']
      LinkLogic.updatedDocumentForDatabase(article, document, properties)
      expect(document).toEqual({
        properties: {
          title: 't1',
          description: 'd1'
        }
      })
    })
    it('updates properties', function () {
      const article = {
        link: 'a',
        date: new Date(),
        author: null
      }
      const document = {
        properties: {
          link: 'b'
        }
      }
      const properties = ['link']
      LinkLogic.updatedDocumentForDatabase(article, document, properties)
      expect(document).toEqual({
        properties: {
          link: 'a'
        }
      })
    })
    it('returns false for no changes', function () {
      const article = {
        title: 't1'
      }
      const document = {
        properties: {
          title: 't1'
        }
      }
      const properties = ['title']
      const changed = LinkLogic.updatedDocumentForDatabase(article, document, properties)
      expect(changed).toEqual(false)
    })
    it('returns true for changes', function () {
      const article = {
        title: 't1'
      }
      const document = {
        properties: {}
      }
      const properties = ['title']
      const changed = LinkLogic.updatedDocumentForDatabase(article, document, properties)
      expect(changed).toEqual(true)
    })
    it('returns true if pruned', function () {
      const article = {}
      const document = {
        properties: {
          title: 't1',
          holla: 'there',
          bo: 'gh'
        }
      }
      jest.spyOn(LinkLogic, 'prunedDocumentForDatabase')
        .mockReturnValue(true)
      const properties = []
      const changed = LinkLogic.updatedDocumentForDatabase(article, document, properties)
      expect(changed).toEqual(true)
    })
  })
  describe('prunedDocumentForDatabase', function () {
    it('deletes all irrelevant keys', function () {
      const document = {
        properties: {
          a: '1',
          b: '2',
          title: 'hi'
        }
      }
      const properties = ['title']
      LinkLogic.prunedDocumentForDatabase(document, properties)
      expect(document.a).toBeUndefined()
      expect(document.b).toBeUndefined()
    })
    it('returns true if deleted keys', function () {
      const document = {
        properties: {
          a: '1',
          b: '2',
          title: 'hi'
        }
      }
      const properties = ['title']
      const pruned = LinkLogic.prunedDocumentForDatabase(document, properties)
      expect(pruned).toEqual(true)
    })
    it('returns true if no deleted keys', function () {
      const document = {
        properties: {
          title: 'hi'
        }
      }
      const properties = ['title']
      const pruned = LinkLogic.prunedDocumentForDatabase(document, properties)
      expect(pruned).toEqual(false)
    })
  })
  describe('getInsertsAndUpdates', function () {
    it('returns the formatted articles for new insertions', function () {
      const articleList = [{
        _id: 'foo'
      }, {
        _id: 'bar'
      }]
      const dbDocs = [{
        _id: 'foo'
      }]
      const spy = jest.spyOn(LinkLogic, 'formatArticleForDatabase')
        .mockReturnValueOnce('abc')
      const logic = new LinkLogic({ ...DEFAULT_DATA, useIdType: 1 })
      const returned = logic.getInsertsAndUpdates(articleList, dbDocs, [])
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0][0]).toEqual(articleList[1])
      expect(returned.toInsert).toContain('abc')
    })
    it('returns the updated articles for existing insertions', function () {
      const articleList = [{
        _id: 'foo'
      }, {
        _id: 'bar'
      }]
      const dbDocs = [{
        _id: 'foo'
      }, {
        _id: 'bar'
      }]
      const spy = jest.spyOn(LinkLogic, 'updatedDocumentForDatabase')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      const logic = new LinkLogic({ ...DEFAULT_DATA })
      const returned = logic.getInsertsAndUpdates(articleList, dbDocs, [])
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy.mock.calls[0][0]).toEqual(articleList[0])
      expect(spy.mock.calls[1][0]).toEqual(articleList[1])
      expect(returned.toUpdate).toHaveLength(1)
      expect(returned.toUpdate).toContain(dbDocs[1])
    })
  })
  describe('insertDocuments', function () {
    afterEach(function () {
      dbCmds.bulkInsert.mockRestore()
    })
    it('adds documents to memoryCollection if databaseless', async function () {
      const memoryCollection = [{
        foo: 1
      }]
      const documents = [{
        a: 1
      }, {
        b: 2
      }]
      await LinkLogic.insertDocuments(documents, memoryCollection)
      expect(memoryCollection).toEqual([{
        foo: 1
      }, {
        a: 1
      }, {
        b: 2
      }])
    })
    it('calls dbCmds bulk insert', async function () {
      const documents = [{
        a: 1
      }, {
        b: 2
      }]
      await LinkLogic.insertDocuments(documents)
      expect(dbCmds.bulkInsert).toHaveBeenCalledWith(documents)
    })
  })
  describe('updateDocuments', function () {
    afterEach(function () {
      dbCmds.update.mockReset()
    })
    it('calls db update with every document if mongodb', async function () {
      const documents = [{
        a: 1
      }, {
        b: 2
      }]
      await LinkLogic.updateDocuments(documents)
      expect(dbCmds.update).toHaveBeenCalledWith(documents[0])
      expect(dbCmds.update).toHaveBeenCalledWith(documents[1])
    })
    it('replaces data in memory collection if databaseless', async function () {
      const memoryCollection = [{
        _id: '1',
        foo: 'foo1'
      }, {
        _id: '2',
        foo: 'foo2'
      }]
      const documents = [{
        _id: '1',
        jack: 'pot'
      }]
      await LinkLogic.updateDocuments(documents, memoryCollection)
      expect(memoryCollection).toEqual([{
        _id: '1',
        jack: 'pot'
      }, {
        _id: '2',
        foo: 'foo2'
      }])
    })
  })
  describe('static shouldCheckDates', function () {
    it('should return config val if feed setting is not there', function () {
      const config = {
        feeds: {
          checkDates: true
        }
      }
      const feed = {}
      expect(LinkLogic.shouldCheckDates(config, feed))
        .toEqual(true)
    })
    it('should return feed val if it exists', function () {
      const config = {
        feeds: {
          checkDates: false
        }
      }
      const feed = {
        checkDates: true
      }
      expect(LinkLogic.shouldCheckDates(config, feed))
        .toEqual(true)
    })
  })
  describe('getNewArticlesOfFeed', function () {
    afterEach(function () {
      ArticleIDResolver.getIDTypeValue.mockReset()
    })
    it('returns the new articles', function () {
      const articleList = [{}, {}, {}]
      const logic = new LinkLogic({ ...DEFAULT_DATA })
      const formatted = {
        foo: 'baz'
      }
      jest.spyOn(logic, 'isNewArticle')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
      jest.spyOn(LinkLogic, 'formatArticle')
        .mockReturnValue(formatted)
      const newArticles = logic.getNewArticlesOfFeed(new Set(), {}, articleList, new Map())
      expect(newArticles).toHaveLength(1)
      expect(newArticles[0]).toEqual(formatted)
    })
    it('attaches _id to all articles', function () {
      const articleList = [{}, {}, {}]
      const logic = new LinkLogic({ ...DEFAULT_DATA })
      ArticleIDResolver.getIDTypeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(3)
      jest.spyOn(logic, 'isNewArticle')
        .mockReturnValue(false)
      jest.spyOn(LinkLogic, 'formatArticle')
        .mockReturnValue({})
      logic.getNewArticlesOfFeed(new Set(), {}, articleList, new Map())
      expect(articleList[0]._id).toEqual(3)
      expect(articleList[1]._id).toEqual(2)
      expect(articleList[2]._id).toEqual(1)
    })
  })
})
