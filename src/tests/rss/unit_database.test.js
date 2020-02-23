const databaseFuncs = require('../../rss/database.js')
const dbCmds = require('../../rss/db/commands.js')

jest.mock('../../rss/db/commands.js')

describe('Unit::rss/database', function () {
  afterEach(function () {
    dbCmds.findAll.mockReset()
    dbCmds.update.mockReset()
    dbCmds.bulkInsert.mockReset()
    jest.restoreAllMocks()
  })
  describe('formatArticleForDatabase', function () {
    it('attaches the critical values', function () {
      const meta = {
        feedURL: 'abc',
        shardID: 2,
        scheduleName: 'ewstg'
      }
      const article = {
        _id: 'abc'
      }
      const formatted = databaseFuncs.formatArticleForDatabase(article, [], meta)
      expect(formatted).toEqual(expect.objectContaining({
        id: article._id,
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
      const formatted = databaseFuncs.formatArticleForDatabase(article, properties, {})
      expect(formatted.properties).toEqual({
        title: article.title,
        description: article.description
      })
    })
  })
  describe('updatedDocumentForDatabase', function () {
    beforeEach(function () {
      jest.spyOn(databaseFuncs, 'prunedDocumentForDatabase')
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
      databaseFuncs.updatedDocumentForDatabase(article, document, properties)
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
      databaseFuncs.updatedDocumentForDatabase(article, document, properties)
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
      const changed = databaseFuncs.updatedDocumentForDatabase(article, document, properties)
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
      const changed = databaseFuncs.updatedDocumentForDatabase(article, document, properties)
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
      jest.spyOn(databaseFuncs, 'prunedDocumentForDatabase')
        .mockReturnValue(true)
      const properties = []
      const changed = databaseFuncs.updatedDocumentForDatabase(article, document, properties)
      expect(changed).toEqual(true)
    })
  })
  describe('getInsertsAndUpdates', function () {
    const meta = {
      feedURL: '1',
      shardID: 2,
      scheduleName: 'awsd'
    }
    it('returns the formatted articles for new insertions', function () {
      const articleList = [{
        _id: 'foo'
      }, {
        _id: 'bar'
      }]
      const dbDocs = [{
        id: 'foo'
      }]
      const spy = jest.spyOn(databaseFuncs, 'formatArticleForDatabase')
        .mockReturnValueOnce('abc')
      const returned = databaseFuncs.getInsertsAndUpdates(articleList, dbDocs, [], meta)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0][0]).toEqual(articleList[1])
      expect(returned.toInsert).toContain('abc')
    })
    it('ignores articles with invalid IDs', function () {
      const articleList = [{
        _id: null
      }]
      const dbDocs = []
      const spy = jest.spyOn(databaseFuncs, 'formatArticleForDatabase')
      const returned = databaseFuncs.getInsertsAndUpdates(articleList, dbDocs, [], meta)
      expect(spy).toHaveBeenCalledTimes(0)
      expect(returned.toInsert).toEqual([])
    })
    it('returns the updated articles for existing insertions', function () {
      const articleList = [{
        _id: 'foo'
      }, {
        _id: 'bar'
      }]
      const dbDocs = [{
        id: 'foo'
      }, {
        id: 'bar'
      }]
      const spy = jest.spyOn(databaseFuncs, 'updatedDocumentForDatabase')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      const returned = databaseFuncs.getInsertsAndUpdates(articleList, dbDocs, [], meta)
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
      await databaseFuncs.insertDocuments(documents, memoryCollection)
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
      await databaseFuncs.insertDocuments(documents)
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
      await databaseFuncs.updateDocuments(documents)
      expect(dbCmds.update).toHaveBeenCalledWith(documents[0])
      expect(dbCmds.update).toHaveBeenCalledWith(documents[1])
    })
    it('replaces data in memory collection if databaseless', async function () {
      const memoryCollection = [{
        id: '1',
        foo: 'foo1'
      }, {
        id: '2',
        foo: 'foo2'
      }]
      const documents = [{
        id: '1',
        jack: 'pot'
      }]
      await databaseFuncs.updateDocuments(documents, memoryCollection)
      expect(memoryCollection).toEqual([{
        id: '1',
        jack: 'pot'
      }, {
        id: '2',
        foo: 'foo2'
      }])
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
      databaseFuncs.prunedDocumentForDatabase(document, properties)
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
      const pruned = databaseFuncs.prunedDocumentForDatabase(document, properties)
      expect(pruned).toEqual(true)
    })
    it('returns true if no deleted keys', function () {
      const document = {
        properties: {
          title: 'hi'
        }
      }
      const properties = ['title']
      const pruned = databaseFuncs.prunedDocumentForDatabase(document, properties)
      expect(pruned).toEqual(false)
    })
  })
  describe('getAllDocuments', function () {
    it('returns memory collection if memory', async function () {
      const memoryCollection = {
        foo: 'bar'
      }
      const returned = await databaseFuncs.getAllDocuments(1, 'sa', memoryCollection)
      expect(returned).toEqual(memoryCollection)
    })
    it('calls other function correctly', async function () {
      const shardID = 33
      const scheduleName = 'aqwrsefd'
      const mappedResult = {
        foo: 'aa'
      }
      const spy = jest.spyOn(databaseFuncs, 'mapArticleDocumentsToURL')
        .mockReturnValue(mappedResult)
      const returned = await databaseFuncs.getAllDocuments(shardID, scheduleName)
      expect(spy).toHaveBeenCalledWith(shardID, scheduleName)
      expect(returned).toEqual(mappedResult)
    })
  })
  describe('mapArticleDocumentsToURL', function () {
    it('returns correctly', async function () {
      const articles = [{
        feedURL: '1',
        id: 1
      }, {
        feedURL: '2',
        id: 2
      }, {
        feedURL: '1',
        id: 3
      }]
      dbCmds.findAll.mockResolvedValue(articles)
      const result = await databaseFuncs.mapArticleDocumentsToURL(1, '')
      expect(result).toEqual({
        '1': [{
          ...articles[0]
        }, {
          ...articles[2]
        }],
        '2': [{
          ...articles[1]
        }]
      })
    })
  })
})
