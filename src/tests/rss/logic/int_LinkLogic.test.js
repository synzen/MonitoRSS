const LinkLogic = require('../../../rss/logic/LinkLogic.js')
const dbCmds = require('../../../rss/db/commands.js')
jest.mock('../../../rss/db/commands.js')

describe('Int::LinkLogic', function () {
  it('emits article for new articles', async function () {
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
    const expectedArticle = {
      _id: '2',
      guid: '2',
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
  })
})