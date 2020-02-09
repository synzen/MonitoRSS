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
  describe('run()', function () {
    afterEach(function () {
      dbCmds.update.mockReset()
    })
    it('throws an error if no scheduleName is defined', function () {
      const logic = new LinkLogic(DEFAULT_DATA)
      const expected = expect.objectContaining({
        message: expect.stringContaining('schedule')
      })
      return expect(logic.run()).rejects.toEqual(expected)
    })
    it('returns the correct object with no db IDs for non-memory database', async function () {
      const link = 'atgedi'
      const logic = new LinkLogic({ ...DEFAULT_DATA, link, scheduleName: 'abc' })
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.getUnseenArticles = async () => Promise.resolve()
      const results = await logic.run()
      const expected = {
        link,
        memoryCollection: undefined,
        memoryCollectionID: undefined
      }
      expect(results).toEqual(expected)
    })
    it('returns the correct object with no db IDs for memory database', async function () {
      const shardID = 2
      const scheduleName = 'q3ewtsg'
      const link = 'atgedi'
      const memoryCollectionID = shardID + scheduleName + link
      const feedData = {
        [memoryCollectionID]: [ 'abc' ]
      }
      const logic = new LinkLogic({
        ...DEFAULT_DATA,
        link,
        scheduleName,
        feedData,
        shardID
      })
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.getUnseenArticles = async () => Promise.resolve()
      const results = await logic.run()
      expect(results).toEqual({
        link,
        memoryCollection: feedData[memoryCollectionID],
        memoryCollectionID
      })
    })
    it('returns the correct object with IDs for non-memory database', async function () {
      const link = 'atgedi'
      const logic = new LinkLogic({ ...DEFAULT_DATA, link, scheduleName: 'abc', rssList: {} })
      logic.dbIDs.add('abc')
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.getUnseenArticles = async () => Promise.resolve()
      logic.checkIfNewArticle = jest.fn()
      const results = await logic.run()
      expect(results).toEqual({
        link,
        memoryCollection: undefined,
        memoryCollectionID: undefined
      })
    })
    it('returns the correct object with IDs for memory database', async function () {
      const link = 'atgedi'
      const shardID = 2
      const scheduleName = 'qe3wt'
      const memoryCollectionID = shardID + scheduleName + link
      const feedData = { [memoryCollectionID]: [ 'abc' ] }
      const logic = new LinkLogic({
        ...DEFAULT_DATA,
        link,
        scheduleName,
        rssList: {},
        feedData,
        shardID
      })
      logic.dbIDs.add('abc')
      logic.getDataFromDocuments = async () => Promise.resolve()
      logic.getUnseenArticles = async () => Promise.resolve()
      logic.checkIfNewArticle = jest.fn()
      const results = await logic.run()
      expect(results).toEqual({
        link,
        memoryCollection: feedData[memoryCollectionID],
        memoryCollectionID: memoryCollectionID
      })
    })
  })
  describe('getDataFromDocuments()', function () {
    it('adds ids to this.dbIDs', async function () {
      const logic = new LinkLogic(DEFAULT_DATA)
      const resolvedDocuments = [{ id: 'abc' }, { id: 'def' }]
      await logic.getDataFromDocuments(resolvedDocuments)
      for (const doc of resolvedDocuments) {
        expect(logic.dbIDs.has(doc.id)).toEqual(true)
      }
    })
    it('adds titles to this.dbTitles', async function () {
      const logic = new LinkLogic(DEFAULT_DATA)
      const resolvedDocuments = [{ title: 'abc' }, { title: 'def' }]
      await logic.getDataFromDocuments(resolvedDocuments)
      for (const doc of resolvedDocuments) {
        expect(logic.dbTitles.has(doc.title)).toEqual(true)
      }
    })
  })
  describe('getUnseenArticles()', function () {
    afterEach(function () {
      dbCmds.bulkInsert.mockReset()
    })
    it('attaches the _id property to all articles', async function () {
      const articleList = [{}, {}]
      const logic = new LinkLogic({ ...DEFAULT_DATA, articleList })
      ArticleIDResolver.getIDTypeValue
        .mockReturnValueOnce('a')
        .mockReturnValueOnce('b')
      await logic.getUnseenArticles()
      expect(articleList[0]._id).toEqual('a')
      expect(articleList[1]._id).toEqual('b')
    })
    it('returns with the new articles', async function () {
      const articleList = [{
        _id: 1
      }, {
        _id: 2
      }, {
        _id: 3
      }]
      const logic = new LinkLogic({ ...DEFAULT_DATA, articleList })
      ArticleIDResolver.getIDTypeValue
        .mockReturnValueOnce(articleList[0]._id)
        .mockReturnValueOnce(articleList[1]._id)
        .mockReturnValueOnce(articleList[2]._id)
      logic.dbIDs.add(articleList[0]._id)
      logic.dbIDs.add(articleList[2]._id)
      const returned = await logic.getUnseenArticles()
      expect(returned).toEqual([articleList[1]])
    })
  })
  describe('static formatArticle()', function () {
    it('attaches the rssName and source', function () {
      const article = { dink: 2 }
      const feed = { donk: 1 }
      const formatted = LinkLogic.formatArticle(article, feed)
      expect(formatted._feed).toEqual(feed)
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
  describe('checkIfNewArticle()', function () {
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
        const article = { title: 'abc' }
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.dbTitles.add(article.title)
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
        const article = { title: 'abc' }
        const rssName = 'adeglk'
        const logic = new LinkLogic(DEFAULT_DATA)
        expect(logic.sentTitlesByFeedID[rssName]).toBeUndefined()
        jest.spyOn(logic, 'determineArticleChecks').mockReturnValueOnce({ checkDates: false, checkTitles: true })
        logic.checkIfNewArticle(rssName, {}, article)
        expect(logic.sentTitlesByFeedID[rssName]).toContain(article.title)
      })
      it('does not emit article when the article title is in this.sentTitlesByFeedID[rssName] when check titles is true', function () {
        const article = { title: 'abc' }
        const rssName = 'adeglk'
        const logic = new LinkLogic(DEFAULT_DATA)
        logic.sentTitlesByFeedID[rssName] = new Set([ article.title ])
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
})
