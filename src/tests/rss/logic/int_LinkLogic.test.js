const LinkLogic = require('../../../rss/logic/LinkLogic.js')
const dbCmds = require('../../../rss/db/commands.js')

jest.mock('../../../rss/db/commands.js')

describe('Int::LinkLogic', function () {
  afterEach(function () {
    dbCmds.bulkInsert.mockReset()
    dbCmds.findAll.mockReset()
    dbCmds.update.mockReset()
  })
  it('emits article for new articles via ID', async function () {
    const data = {
      shardID: -1,
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
      _feed: {}
    }
    const expectedArticle2 = {
      _id: '4',
      guid: '4',
      _feed: {}
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
      shardID: -1,
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
      shardID: -1,
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
      shardID: -1,
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
      _feed: {}
    }
    const expectedArticle2 = {
      _id: '2',
      guid: '2',
      _feed: {}
    }
    const logic = new LinkLogic(data)
    const articleSpy = jest.fn()
    dbCmds.findAll.mockResolvedValueOnce([ { id: '1' }, { id: '3' } ])
    logic.on('article', articleSpy)
    await logic.run()
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle)
    expect(articleSpy).toHaveBeenCalledWith(expectedArticle2)
  })
  it('inserts unseen articles via ID into database', async function () {
    const data = {
      shardID: -1,
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
    expect(dbCmds.bulkInsert).toHaveBeenCalledWith(undefined, [{
      ...data.articleList[1],
      _id: data.articleList[1].guid
    }], data.link, data.shardID, data.scheduleName)
  })
  it('does not emit article for no new articles', async function () {
    const data = {
      shardID: -1,
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
