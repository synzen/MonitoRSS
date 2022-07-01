process.env.TEST_ENV = true
const NewArticle = require('../../structs/NewArticle.js')
const LinkLogic = require('../../structs/LinkLogic.js')

jest.mock('../../structs/NewArticle.js')
jest.mock('../../config.js')

const DEFAULT_DATA = { config: { feeds: {} } }

describe('Unit::LinkLogic', function () {
  beforeEach(function () {
    jest.restoreAllMocks()
    NewArticle.mockReset()
  })
  describe('static getArticleProperty', function () {
    it('returns correctly', function () {
      const article = {
        foo: {
          bar: {
            here: 1
          }
        }
      }
      const accessor = 'foo_bar_here'
      expect(LinkLogic.getArticleProperty(article, accessor))
        .toEqual(1)
    })
    it('returns undefined on invalid property', function () {
      const article = {
        foo: {
          bar: {
            here: 1
          }
        }
      }
      const accessor = 'foo_bar_here_doo_dat'
      expect(LinkLogic.getArticleProperty(article, accessor))
        .toBeUndefined()
    })
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
    describe('id is undefined', function () {
      it('returns false', function () {
        const logic = new LinkLogic({ ...DEFAULT_DATA })
        const article = {
          _id: undefined
        }
        const feed = {
          pcomparisons: [],
          ncomparisons: []
        }
        expect(logic.isNewArticle(new Set(), article, feed, false, new Map()))
          .toEqual(false)
      })
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
      it('uses the feed article max age if available', function () {
        const logicData = {
          config: {
            feeds: {
              cycleMaxAge: 2
            }
          }
        }
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 4)
        const oldArticle = {
          ...article,
          pubdate: oldDate
        }
        const feed = {
          articleMaxAge: 10
        }
        const logic = new LinkLogic({ ...logicData })
        expect(logic.isNewArticle(dbIDs, oldArticle, feed, true, new Map()))
          .toEqual(true)
      })
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
    it('returns the new articles', function () {
      const articleList = [{
        _id: 'a'
      }, {
        _id: 'b'
      }, {
        _id: 'c'
      }]
      const logic = new LinkLogic({ ...DEFAULT_DATA })
      const formatted = {
        foo: 'baz'
      }
      jest.spyOn(logic, 'isNewArticle')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
      NewArticle.mockImplementation(() => {
        return formatted
      })
      const newArticles = logic.getNewArticlesOfFeed(new Set(), {}, articleList, new Map())
      expect(newArticles).toHaveLength(1)
      expect(newArticles[0]).toEqual(formatted)
    })
  })
})
