const LinkLogic = require('../../../rss/logic/LinkLogic.js')
const ArticleModel = require('../../../models/Article.js')
const ArticleIDResolver = require('../../../structs/ArticleIDResolver.js')
const dbCmds = require('../../../rss/db/commands.js')

const DEFAULT_DATA = { config: { feeds: {} } }

jest.mock('../../../rss/db/commands.js')
jest.mock('../../../util/logger.js')
jest.mock('../../../config.js')
jest.mock('../../../structs/ArticleIDResolver.js')
jest.mock('../../../models/Article.js')

describe('Unit::LinkLogic', function () {
  describe('run()', function () {
    afterEach(function () {
      dbCmds.update.mockReset()
    })
    it('throws an error if no scheduleName is defined', function () {
      const logic = new LinkLogic(DEFAULT_DATA)
      return expect(logic.run()).rejects.toEqual(expect.objectContaining({ message: expect.stringContaining('schedule') }))
    })
    it('returns the correct object with no db IDs for non-memory database', async function () {
      const link = 'atgedi'
      const logic = new LinkLogic({ ...DEFAULT_DATA, link, scheduleName: 'abc' })
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.articleListTasks = async () => Promise.resolve()
      const results = await logic.run()
      expect(results).toEqual({ link, feedCollection: undefined, feedCollectionId: undefined })
    })
    it('returns the correct object with no db IDs for memory database', async function () {
      const link = 'atgedi'
      const feedCollectionId = 'aqetwh4'
      const feedData = { [feedCollectionId]: [ 'abc' ] }
      const logic = new LinkLogic({ ...DEFAULT_DATA, link, scheduleName: 'abc', feedData })
      ArticleModel.getCollectionID.mockReturnValueOnce(feedCollectionId)
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.articleListTasks = async () => Promise.resolve()
      const results = await logic.run()
      expect(results).toEqual({ link, feedCollection: feedData[feedCollectionId], feedCollectionId })
    })
    it('returns the correct object with IDs for non-memory database', async function () {
      const link = 'atgedi'
      const logic = new LinkLogic({ ...DEFAULT_DATA, link, scheduleName: 'abc', rssList: {} })
      logic.dbIDs.add('abc')
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.articleListTasks = async () => Promise.resolve()
      logic.validateCustomComparisons = jest.fn()
      logic.checkIfNewArticle = jest.fn()
      const results = await logic.run()
      expect(results).toEqual({ link, feedCollection: undefined, feedCollectionId: undefined })
    })
    it('returns the correct object with IDs for memory database', async function () {
      const link = 'atgedi'
      const feedCollectionId = 'aqetwh4'
      const feedData = { [feedCollectionId]: [ 'abc' ] }
      const logic = new LinkLogic({ ...DEFAULT_DATA, link, scheduleName: 'abc', rssList: {}, feedData })
      logic.dbIDs.add('abc')
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.articleListTasks = async () => Promise.resolve()
      logic.validateCustomComparisons = jest.fn()
      logic.checkIfNewArticle = jest.fn()
      ArticleModel.getCollectionID.mockReturnValueOnce(feedCollectionId)
      const results = await logic.run()
      expect(results).toEqual({ link, feedCollection: feedData[feedCollectionId], feedCollectionId: feedCollectionId })
    })
    it('calls dbCmds.update for articles in toUpdate', async function () {
      const logic = new LinkLogic({ ...DEFAULT_DATA, scheduleName: 'abc', rssList: {} })
      logic.dbIDs.add('abc')
      const article1 = { foo: '1' }
      const article2 = { bar: '2' }
      logic.toUpdate['asd'] = article1
      logic.toUpdate['asd2'] = article2
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.articleListTasks = async () => Promise.resolve()
      logic.validateCustomComparisons = jest.fn()
      logic.checkIfNewArticle = jest.fn()
      await logic.run()
      expect(dbCmds.update).toHaveBeenCalledWith(undefined, article1)
      expect(dbCmds.update).toHaveBeenCalledWith(undefined, article2)
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
      const resolvedDocuments = [{ customComparisons: { placeholder: 'c' } }, { customComparisons: { title: 'a' } }]
      dbCmds.findAll.mockResolvedValueOnce(resolvedDocuments)
      await logic.getDataFromDocuments()
      for (const doc of resolvedDocuments) {
        const comparisons = doc.customComparisons
        for (const comparisonName in comparisons) {
          const articleValue = comparisons[comparisonName]
          expect(logic.dbCustomComparisons[comparisonName].has(articleValue)).toEqual(true)
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
      const formatted = LinkLogic.formatArticle(article, source, rssName)
      expect(formatted._delivery.source).toEqual(source)
      expect(formatted._delivery.rssName).toEqual(rssName)
    })
  })
  describe('determineArticleChecks()', function () {
    it('returns memoized settings if they exist', function () {
      const rssName = 'aedkglnhrfjnb'
      const memoized = { ho: 1, dunk: 2 }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.memoizedSourceSettings[rssName] = memoized
      expect(logic.determineArticleChecks({}, rssName)).toEqual(memoized)
    })
    it('adds to memoized settings if they don\'t exist', function () {
      const rssName = 'aedkglnhrfjnb'
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.determineArticleChecks({}, rssName)
      expect(logic.memoizedSourceSettings).toHaveProperty(rssName)
    })
    it('returns the source date check settings if they exist', function () {
      const rssName1 = 'aegkjt'
      const rssName2 = rssName1 + 1
      const logic = new LinkLogic(DEFAULT_DATA)
      const source1 = { checkDates: true }
      const source2 = { checkDates: false }
      expect(logic.determineArticleChecks(source1, rssName1).checkDates).toEqual(source1.checkDates)
      expect(logic.determineArticleChecks(source2, rssName2).checkDates).toEqual(source2.checkDates)
    })
    it('returns the source date check settings if they exist', function () {
      const rssName1 = 'aegkjt'
      const rssName2 = rssName1 + 1
      const logic = new LinkLogic(DEFAULT_DATA)
      const source1 = { checkDates: true }
      const source2 = { checkDates: false }
      expect(logic.determineArticleChecks(source1, rssName1).checkDates).toEqual(source1.checkDates)
      expect(logic.determineArticleChecks(source2, rssName2).checkDates).toEqual(source2.checkDates)
    })
    it('returns the default date check settings if source setting does\'t exist', function () {
      const data1 = { config: { feeds: { checkDates: true } } }
      const data2 = { config: { feeds: { checkDates: false } } }
      const logic1 = new LinkLogic(data1)
      const logic2 = new LinkLogic(data2)
      expect(logic1.determineArticleChecks({}, 'rssName1').checkDates).toEqual(data1.config.feeds.checkDates)
      expect(logic2.determineArticleChecks({}, 'rssName1').checkDates).toEqual(data2.config.feeds.checkDates)
    })
    it('returns the source title check settings if they exist', function () {
      const rssName1 = 'aegkjt'
      const rssName2 = rssName1 + 1
      const logic = new LinkLogic(DEFAULT_DATA)
      const source1 = { checkDates: true }
      const source2 = { checkDates: false }
      expect(logic.determineArticleChecks(source1, rssName1).checkDates).toEqual(source1.checkDates)
      expect(logic.determineArticleChecks(source2, rssName2).checkDates).toEqual(source2.checkDates)
    })
    it('returns the default title check settings if source setting does\'t exist', function () {
      const data1 = { config: { feeds: { checkTitles: true } } }
      const data2 = { config: { feeds: { checkTitles: false } } }
      const logic1 = new LinkLogic(data1)
      const logic2 = new LinkLogic(data2)
      expect(logic1.determineArticleChecks({}, 'rssName1').checkTitles).toEqual(data1.config.feeds.checkTitles)
      expect(logic2.determineArticleChecks({}, 'rssName1').checkTitles).toEqual(data2.config.feeds.checkTitles)
    })
    it('memoizes the calculated values', function () {
      const rssName = 'rssNameqew'
      const data1 = { config: { feeds: { checkTitles: true } } }
      const source1 = { checkDates: false }
      const logic1 = new LinkLogic(data1)
      logic1.determineArticleChecks(source1, rssName)
      expect(logic1.memoizedSourceSettings).toHaveProperty(rssName)
      expect(logic1.memoizedSourceSettings[rssName].checkTitles).toEqual(data1.config.feeds.checkTitles)
      expect(logic1.memoizedSourceSettings[rssName].checkDates).toEqual(source1.checkDates)
    })
  })
  describe('validateCustomComparisons()', function () {
    it('removes invalid custom comparison types from source.customComparisons', function () {
      const source = { customComparisons: ['title', 'guid', 'valid1', 'pubdate', 'valid2'] }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.validateCustomComparisons(source)
      expect(source.customComparisons).not.toContain('title')
      expect(source.customComparisons).not.toContain('guid')
      expect(source.customComparisons).not.toContain('pubdate')
      expect(source.customComparisons).toContain('valid1')
      expect(source.customComparisons).toContain('valid2')
    })
    it('adds to this.customComparisonsToUpdate if the comparison was not found in db', function () {
      const source = { customComparisons: ['valid1', 'valid2', 'valid3'] }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.dbCustomComparisonsToDelete.add(source.customComparisons[1])
      logic.validateCustomComparisons(source)
      expect(logic.customComparisonsToUpdate).toContain(source.customComparisons[0])
      expect(logic.customComparisonsToUpdate).toContain(source.customComparisons[2])
    })
  })
  describe('checkIfNewArticle()', function () {
    it('calls this.checkIfNewArticleByCC if article is not emitted', function () {
      const article = { _id: 1 }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.dbIDs.add(article._id)
      jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: false })
      const emitSpy = jest.spyOn(logic, 'checkIfNewArticleByCC')
      logic.checkIfNewArticle('', {}, article)
      expect(emitSpy).toHaveBeenCalled()
    })
    it('emits the formatted article', function () {
      const formattedArticle = { dingus: 'berry' }
      const logic = new LinkLogic(DEFAULT_DATA)
      jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: false })
      jest.spyOn(LinkLogic, 'formatArticle').mockReturnValueOnce(formattedArticle)
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticle('', {}, {})
      expect(emitSpy).toHaveBeenCalledWith('article', formattedArticle)
    })
    it('calls emit when this.runNum is 0 and config.feeds.sendOldOnFirstCycle is true', function () {
      const logic = new LinkLogic({ ...DEFAULT_DATA, config: { feeds: { sendOldOnFirstCycle: true } }, runNum: 0 })
      jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: false })
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticle('', {}, {})
      expect(emitSpy).toHaveBeenCalled()
    })
    it('does not call emit when this.runNum is 0 and config.feeds.sendOldOnFirstCycle is false', function () {
      const logic = new LinkLogic({ ...DEFAULT_DATA, config: { feeds: { sendOldOnFirstCycle: false } }, runNum: 0 })
      jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: false })
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticle('', {}, {})
      expect(emitSpy).not.toHaveBeenCalled()
    })
    describe('id', function () {
      it('emits article when id was not found in this.dbIDs', function () {
        const article = { _id: 1 }
        const formattedArticle = { dingus: 'berry' }
        const logic = new LinkLogic(DEFAULT_DATA)
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: false })
        jest.spyOn(LinkLogic, 'formatArticle').mockReturnValueOnce(formattedArticle)
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).toHaveBeenCalled()
      })
      it('does not emit article if id was found in this.dbIDs', function () {
        const article = { _id: 1 }
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.dbIDs.add(article._id)
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: false })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).not.toHaveBeenCalled()
      })
    })
    describe('title checks', function () {
      it('emits article when check titles is true, titles is not in this.dbTitles, and article.title exists', function () {
        const article = { title: 'abc' }
        const logic = new LinkLogic(DEFAULT_DATA)
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: true })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).toHaveBeenCalled()
      })
      it('does not emit article when check titles is true, titles is in this.dbTitles, and article.title exists', function () {
        const article = { title: 'AbC' }
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.dbTitles.add('abc')
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: true })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).not.toHaveBeenCalled()
      })
      it('does not emit article when check titles is true, titles is not in this.dbTitles, and article.title does exists', function () {
        const article = { }
        const logic = new LinkLogic(DEFAULT_DATA)
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: true })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).not.toHaveBeenCalled()
      })
      it('adds the article title to this.sentTitlesByFeedID[rssName] when check titles is true and titles is not in this.dbTitles', function () {
        const article = { title: 'aBc' }
        const rssName = 'adeglk'
        const logic = new LinkLogic(DEFAULT_DATA)
        expect(logic.sentTitlesByFeedID[rssName]).toBeUndefined()
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: true })
        logic.checkIfNewArticle(rssName, {}, article)
        expect(logic.sentTitlesByFeedID[rssName]).toContain(article.title.toLowerCase())
      })
      it('does not emit article when the article title is in this.sentTitlesByFeedID[rssName] when check titles is true', function () {
        const article = { title: 'aBC' }
        const rssName = 'adeglk'
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.sentTitlesByFeedID[rssName] = new Set([ article.title.toLowerCase() ])
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: true })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle(rssName, {}, article)
        expect(emitSpy).not.toHaveBeenCalled()
      })
    })
    describe('date checks', function () {
      const invalidDate = new Date('foobar')
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      it('emits article when check dates is true, article date is newer the cutoff date, and article date is valid', function () {
        const article = { pubdate: oneDayAgo }
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.cutoffDay = twoDaysAgo
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: true, checkTitles: false })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).toHaveBeenCalled()
      })
      it('does not emit article when check dates is true, article date is older the cutoff day, and article date is valid', function () {
        const article = { pubdate: twoDaysAgo }
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.cutoffDay = oneDayAgo
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: true, checkTitles: false })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).not.toHaveBeenCalled()
      })
      it('does not emit article when check dates is true and article date is invalid', function () {
        const article = { pubdate: invalidDate }
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.cutoffDay = oneDayAgo
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: true, checkTitles: false })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).not.toHaveBeenCalled()
      })
      it('does not emit article when there is no article date', function () {
        const article = {}
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.cutoffDay = oneDayAgo
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: true, checkTitles: false })
        const emitSpy = jest.spyOn(logic, 'emit')
        logic.checkIfNewArticle('', {}, article)
        expect(emitSpy).not.toHaveBeenCalled()
      })
    })
  })
  describe('checkIfNewArticleByCC()', function () {
    const mockArticle = { hello: 'world' }
    const spy = jest.spyOn(LinkLogic, 'formatArticle')
    beforeEach(function () {
      spy.mockReturnValueOnce(mockArticle)
    })
    it('emits an article if custom comparison is a key in this.dbCustomComparisons and article value was not found', function () {
      const comparisonName = 'ooo'
      const source = { customComparisons: [comparisonName] }
      const article = { [comparisonName]: 'value' }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.updateArticleCCValues = jest.fn()
      logic.dbCustomComparisons[comparisonName] = new Set()
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticleByCC('', source, article)
      expect(emitSpy).toHaveBeenCalled()
    })
    it('emits a formatted article', function () {
      const comparisonName = 'ooo'
      const source = { customComparisons: [comparisonName] }
      const article = { [comparisonName]: 'value' }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.updateArticleCCValues = jest.fn()
      logic.dbCustomComparisons[comparisonName] = new Set()
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticleByCC('', source, article)
      expect(emitSpy).toHaveBeenCalledWith('article', mockArticle)
    })
    it('does not emit article if the source has no customComparisons', function () {
      const article = {}
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.updateArticleCCValues = jest.fn()
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticleByCC('', {}, article)
      expect(emitSpy).not.toHaveBeenCalled()
    })
    it('does not emit article if the source has non-Array customComparisons', function () {
      const source = { customComparisons: {} }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.updateArticleCCValues = jest.fn()
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticleByCC('', source, {})
      expect(emitSpy).not.toHaveBeenCalled()
    })
    it('does not emit article if the custom comparison is not a key in this.dbCustomComparisons', function () {
      const comparisonName = 'oo'
      const source = { customComparisons: [comparisonName] }
      const article = { [comparisonName]: '123' }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.updateArticleCCValues = jest.fn()
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticleByCC('', source, article)
      expect(emitSpy).not.toHaveBeenCalled()
    })
    it('does not emit article if the custom comparison is a key in this.dbCustomComparisons and article value was found', function () {
      const comparisonName = 'aijf'
      const source = { customComparisons: [comparisonName] }
      const article = { [comparisonName]: 'value' }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.updateArticleCCValues = jest.fn()
      logic.dbCustomComparisons[comparisonName] = new Set([article[comparisonName]])
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticleByCC('', source, article)
      expect(emitSpy).not.toHaveBeenCalled()
    })
    it('does not emit article if the custom comparison is in this.dbCustomComparisonsToDelete', function () {
      const comparisonName = 'aijf'
      const source = { customComparisons: [comparisonName] }
      const article = { [comparisonName]: 'value' }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.updateArticleCCValues = jest.fn()
      logic.dbCustomComparisonsToDelete.add(comparisonName)
      logic.dbCustomComparisons[comparisonName] = new Set()
      const emitSpy = jest.spyOn(logic, 'emit')
      logic.checkIfNewArticleByCC('', source, article)
      expect(emitSpy).not.toHaveBeenCalled()
    })
  })
  describe('updateArticleCCValues()', function () {
    it('adds the article comparison value to article.customComparisons if article.customComparisons does not exist', function () {
      const comparisonName = 'abc'
      const articleID = 'aedf'
      const article = { foo: 'bar', [comparisonName]: 'hodunk', _id: articleID }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.customComparisonsToUpdate.add(comparisonName)
      logic.updateArticleCCValues(article, comparisonName)
      expect(logic.toUpdate[articleID].customComparisons).toBeDefined()
      expect(logic.toUpdate[articleID].customComparisons).toHaveProperty(comparisonName)
      expect(logic.toUpdate[articleID].customComparisons[comparisonName]).toEqual(article[comparisonName])
    })
    it('adds the article to this.toUpdate', function () {
      const comparisonName = 'abc'
      const articleID = 'aedgtjr'
      const article = { foo: 'bar', [comparisonName]: 'hodunk', _id: articleID }
      const logic = new LinkLogic(DEFAULT_DATA)
      logic.customComparisonsToUpdate.add(comparisonName)
      logic.updateArticleCCValues(article, comparisonName)
      expect(logic.toUpdate).toHaveProperty(articleID)
      expect(logic.toUpdate[articleID]).toEqual({ ...article, customComparisons: { [comparisonName]: article[comparisonName] } })
    })
  })
})
