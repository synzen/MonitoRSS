const Article = require('../../structs/Article.js')

describe('Unit::structs/Article', function () {
  const baseArticle = {
    meta: {}
  }
  const feedData = {
    feed: {}
  }
  describe('testFilters', function () {
    it('works with regular filters', function () {
      const article = new Article(baseArticle, feedData)
      article.fullTitle = 'my sentence is this'
      const filters = {
        title: ['foo', 'sentence']
      }
      const returned = article.testFilters(filters)
      expect(returned.passed).toEqual(true)
    })
    it('works with negated filters', function () {
      const article = new Article(baseArticle, feedData)
      article.fullTitle = 'my sentence is this'
      const filters = {
        title: ['!sentence']
      }
      const returned = article.testFilters(filters)
      expect(returned.passed).toEqual(false)
    })
    it('works with broad filters', function () {
      const article = new Article(baseArticle, feedData)
      article.fullTitle = 'my sentence is this'
      const filters = {
        title: ['~ence']
      }
      const returned = article.testFilters(filters)
      expect(returned.passed).toEqual(true)
    })
    it('works with regular and negated filters', function () {
      const article = new Article(baseArticle, feedData)
      article.fullTitle = 'my sentence is this'
      const filters = {
        title: ['!sentence', 'my']
      }
      const returned = article.testFilters(filters)
      expect(returned.passed).toEqual(false)
    })
    it('works with broad and negated filters', function () {
      const article = new Article(baseArticle, feedData)
      article.fullTitle = 'my sentence is this'
      const filters = {
        title: ['!sentence', '~ence']
      }
      const returned = article.testFilters(filters)
      expect(returned.passed).toEqual(false)
    })
  })
})
