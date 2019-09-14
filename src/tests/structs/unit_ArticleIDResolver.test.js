const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')

describe('Unit::ArticleIDResolver', function () {
  describe('constructor', function () {
    const idTypeNames = ['a', 'b', 'c']
    const expectedIDTypes = ['a', 'b', 'c', 'a,b', 'a,c', 'b,c']
    const spy = jest.spyOn(ArticleIDResolver, 'ID_TYPE_NAMES', 'get')
    beforeAll(function () {
      spy.mockReturnValue(idTypeNames)
    })
    afterAll(function () {
      spy.mockRestore()
    })
    it('adds all id types to this.useIdTypes', function () {
      const idResolver = new ArticleIDResolver()
      expect(idResolver.useIdTypes.size).toEqual(expectedIDTypes.length)
      for (const item of expectedIDTypes) {
        expect(idResolver.useIdTypes.has(item)).toEqual(true)
      }
    })
    it('adds all id types as an empty set in this.idsRecorded', function () {
      const idResolver = new ArticleIDResolver()
      for (const item of expectedIDTypes) {
        expect(idResolver.idsRecorded[item]).toBeInstanceOf(Set)
      }
    })
    it('adds the merged id types to this.mergedTypeNames', function () {
      const idResolver = new ArticleIDResolver()
      const expectedMergedTypeNames = ['a,b', 'a,c', 'b,c']
      expect(idResolver.mergedTypeNames).toEqual(expectedMergedTypeNames)
    })
  })
  describe('recordArticle()', function () {
    const mockArticleValue = 'adegtrhfnj'
    const spy = jest.spyOn(ArticleIDResolver, 'getIDTypeValue')
    beforeAll(function () {
      spy.mockReturnValue(mockArticleValue)
    })
    afterAll(function () {
      spy.mockRestore()
    })
    it('adds the articles values to their respective id type in this.idsRecorded', function () {
      const idResolver = new ArticleIDResolver()
      idResolver.useIdTypes = new Set(['a', 'b'])
      idResolver.idsRecorded.a = new Set()
      idResolver.idsRecorded.b = new Set()
      idResolver.recordArticle({}) // This can be empty since article values are accessed with ArticleIDResolve.getIDTypeValue
      expect(idResolver.idsRecorded.a.has(mockArticleValue)).toEqual(true)
      expect(idResolver.idsRecorded.b.has(mockArticleValue)).toEqual(true)
    })
    it('deletes the id type from this.useIdTypes if there is no article value', function () {
      const idResolver = new ArticleIDResolver()
      idResolver.useIdTypes = new Set(['a'])
      idResolver.idsRecorded.a = new Set()
      spy.mockReturnValueOnce(null)
      idResolver.recordArticle({})
      expect(idResolver.useIdTypes.has('a')).toEqual(false)
    })
    it('adds the id type from this.failedTypeNames if there is no article value', function () {
      const idResolver = new ArticleIDResolver()
      idResolver.useIdTypes = new Set(['a'])
      idResolver.idsRecorded.a = new Set()
      spy.mockReturnValueOnce(null)
      idResolver.recordArticle({})
      expect(idResolver.failedTypeNames).toContain('a')
    })
    it('deletes the id type from this.useIdTypes if the article value was seen before', function () {
      const idResolver = new ArticleIDResolver()
      idResolver.useIdTypes = new Set(['a'])
      idResolver.idsRecorded.a = new Set()
      idResolver.recordArticle({})
      idResolver.recordArticle({})
      expect(idResolver.useIdTypes.has('a')).toEqual(false)
    })
    it('adds the id type from this.failedTypeNames if there is no article value', function () {
      const idResolver = new ArticleIDResolver()
      idResolver.useIdTypes = new Set(['a'])
      idResolver.idsRecorded.a = new Set()
      idResolver.recordArticle({})
      idResolver.recordArticle({})
      expect(idResolver.failedTypeNames).toContain('a')
    })
  })
  describe('getIDType()', function () {
    it.todo('returns the first valid id type')
    it.todo('returns the last failed id type if there are no valid id types')
  })
  describe('static getIDTypeValue()', function () {
    it.todo('returns the article value for non-merged id type')
    it.todo('returns the article values joined for a merged id type')
  })
})
