const ArticleIDResolver = require('../../structs/ArticleIDResolver.js')

describe('Unit::ArticleIDResolver', function () {
  const spy = jest.spyOn(ArticleIDResolver, 'ID_TYPE_NAMES', 'get')
  const idTypeNames = ['a', 'b', 'c']
  const expectedIDTypes = ['a', 'b', 'c', 'a,b', 'a,c', 'b,c']
  describe('constructor', function () {
    beforeEach(function () {
      spy.mockReturnValueOnce(idTypeNames)
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
  describe('getIDType()', function () {
    beforeEach(function () {
      spy.mockReturnValue(idTypeNames)
    })
    it('returns the first valid id type', function () {
      const idResolver = new ArticleIDResolver()
      idResolver.mergedTypeNames = ['lswikedgjowir', 'rjhgyn;bkjdn']
      expect(idResolver.getIDType()).toEqual(idTypeNames[0])
    })
    it('returns the first merged id type if there are invalids', function () {
      const idResolver = new ArticleIDResolver()
      for (const idType of idTypeNames) {
        idResolver.useIdTypes.delete(idType)
      }
      expect(idResolver.getIDType()).toEqual(expectedIDTypes[3])
    })
    it('returns the last failed id type if there are no valid id types', function () {
      const idResolver = new ArticleIDResolver()
      idResolver.useIdTypes.clear()
      const failedType = 'aedsgwtdrfkhjnb'
      idResolver.failedTypeNames.push(failedType)
      expect(idResolver.getIDType()).toEqual(failedType)
    })
  })
  describe('static getIDTypeValue()', function () {
    it('returns the article value for non-merged id type', function () {
      const article = { a: 'b', dingus: 'berry' }
      expect(ArticleIDResolver.getIDTypeValue(article, 'a')).toEqual(article.a)
    })
    it('returns the article values joined for a merged id type', function () {
      const article = { joe: 'poe', doe: 'koe' }
      expect(ArticleIDResolver.getIDTypeValue(article, 'doe,joe')).toEqual('koepoe')
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
})
