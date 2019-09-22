const LinkLogic = require('../../../rss/logic/LinkLogic.js')
const dbCmds = require('../../../rss/db/commands.js')
const ArticleModel = require('../../../models/Article.js')
jest.mock('../../../rss/db/commands.js')

describe('Int::LinkLogic', function () {
  afterEach(function () {
    dbCmds.bulkInsert.mockReset()
    dbCmds.findAll.mockReset()
    dbCmds.update.mockReset()
  })
  it('emits article for new articles via ID', async function () {
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {}
      },
      articleList: [
        { guid: '1' },
        { guid: '2' },
        { guid: '3' },
        { guid: '4' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const expectedArticle = {
      _id: '2',
      guid: '2',
      _delivery:
      {
        rssName: 'feedID1',
        source: {}
      }
    }
    const expectedArticle2 = {
      _id: '4',
      guid: '4',
      _delivery:
      {
        rssName: 'feedID1',
        source: {}
      }
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([ { id: '1' }, { id: '3' } ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle)
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle2)
  })
  it('does not emits new article for a new articles with seen title', async function () {
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {
          checkTitles: true
        }
      },
      articleList: [
        { guid: '1', title: 'a' },
        { guid: '2', title: 'b' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([ { id: '1', title: 'a' }, { id: '2', title: 'b' }, { id: '3', title: 'b' } ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).not.toHaveBeenCalled()
  })
  it('does not emits new article for an article with old pubdate with checKDates true', async function () {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {
          checkDates: true
        }
      },
      articleList: [
        { guid: '1' },
        { guid: '2', pubdate: twoDaysAgo }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: { cycleMaxAge: 1 } }
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([ { id: '1', title: 'a' } ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).not.toHaveBeenCalled()
  })
  it('emits article for new articles for multiple sources', async function () {
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {},
        feedID2: {}
      },
      articleList: [
        { guid: '1' },
        { guid: '2' },
        { guid: '3' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const expectedArticle = {
      _id: '2',
      guid: '2',
      _delivery:
      {
        rssName: 'feedID1',
        source: {}
      }
    }
    const expectedArticle2 = {
      _id: '2',
      guid: '2',
      _delivery:
      {
        rssName: 'feedID2',
        source: {}
      }
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([ { id: '1' }, { id: '3' } ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle)
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle2)
  })
  it('emits article for new article via custom comparisons', async function () {
    const comparisonName = 'azdskgethn'
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {
          customComparisons: [comparisonName]
        }
      },
      articleList: [
        { guid: '1', [comparisonName]: 'dingus' },
        { guid: '2', [comparisonName]: 'berry' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const expectedArticle = {
      ...data.articleList[0],
      _id: '1',
      _delivery:
      {
        rssName: 'feedID1',
        source: data.rssList.feedID1
      }
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([
      {
        id: '1',
        customComparisons: {
          [comparisonName]: 'dooo'
        }
      },
      {
        id: '2',
        customComparisons: {
          [comparisonName]: 'berry'
        }
      }
    ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle)
  })
  it('emits article for new articles for multiple sources with custom comparisons', async function () {
    const comparisonName = 'uhiuyguiy'
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {
          customComparisons: [comparisonName]
        },
        feedID2: {
          customComparisons: [comparisonName]
        }
      },
      articleList: [
        { guid: '1', [comparisonName]: 'abc' },
        { guid: '2', [comparisonName]: 'def' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const expectedArticle = {
      ...data.articleList[1],
      _id: '2',
      _delivery:
      {
        rssName: 'feedID1',
        source: data.rssList.feedID1
      }
    }
    const expectedArticle2 = {
      ...data.articleList[1],
      _id: '2',
      _delivery:
      {
        rssName: 'feedID2',
        source: data.rssList.feedID2
      }
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([
      {
        id: '1',
        customComparisons: {
          [comparisonName]: 'abc'
        }
      },
      {
        id: '2',
        customComparisons: {
          [comparisonName]: 'defg'
        }
      }
    ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle)
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle2)
  })
  it('does not emit article for no new articles via custom comparisons', async function () {
    const comparisonName = 'azdskgethn'
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {
          customComparisons: [comparisonName]
        }
      },
      articleList: [
        { guid: '1', [comparisonName]: 'dingus' },
        { guid: '2', [comparisonName]: 'berry' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([
      {
        id: '1',
        customComparisons: {
          [comparisonName]: 'dooo'
        }
      },
      {
        id: '2',
        customComparisons: {
          [comparisonName]: 'berry'
        }
      },
      {
        id: '3',
        customComparisons: {
          [comparisonName]: 'dingus'
        }
      }
    ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).not.toHaveBeenCalled()
  })
  it('calls dbCmds.update if an article\'s custom comparisons needs to be updated', async function () {
    const comparisonName = 'azdskgethn'
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {
          customComparisons: [comparisonName]
        }
      },
      articleList: [
        { guid: '1', [comparisonName]: 'dingus' },
        { guid: '2', [comparisonName]: 'berry' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const logic = new LinkLogic(data)
    dbCmds.findAll.mockResolvedValueOnce([
      {
        id: '1'
      },
      {
        id: '2'
      },
      {
        id: '3'
      }
    ])
    // logic.on('article', articleSpy)
    await logic.run()
    const collectionID = ArticleModel.getCollectionID(data.link, undefined, data.scheduleName)
    const Feed = ArticleModel.modelByID(collectionID)
    expect(dbCmds.update).toHaveBeenCalledWith(Feed, {
      ...data.articleList[0],
      customComparisons: {
        [comparisonName]: data.articleList[0][comparisonName]
      }
    })
    expect(dbCmds.update).toHaveBeenCalledWith(Feed, {
      ...data.articleList[1],
      customComparisons: {
        [comparisonName]: data.articleList[1][comparisonName]
      }
    })
  })
  it('inserts unseen articles via ID into database', async function () {
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {}
      },
      articleList: [
        { guid: '1' },
        { guid: '2' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const logic = new LinkLogic(data)
    dbCmds.findAll.mockResolvedValueOnce([ { id: '1' }, { id: '3' } ])
    await logic.run()
    const collectionID = ArticleModel.getCollectionID(data.link, undefined, data.scheduleName)
    const Feed = ArticleModel.modelByID(collectionID)
    expect(dbCmds.bulkInsert).toHaveBeenCalledWith(Feed, [{ ...data.articleList[1], _id: data.articleList[1].guid }])
  })
  it('does not emit article for no new articles', async function () {
    const data = {
      link: 'https://www.rt.com/rss',
      rssList: {
        feedID1: {}
      },
      articleList: [
        { guid: '1' },
        { guid: '2' },
        { guid: '3' }
      ],
      runNum: 1,
      scheduleName: 'default',
      useIdType: 'guid',
      config: { feeds: {} }
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([ { id: '1' }, { id: '2' }, { id: '3' } ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).not.toHaveBeenCalled()
  })
})
