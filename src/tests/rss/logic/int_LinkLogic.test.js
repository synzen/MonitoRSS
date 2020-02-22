const mongoose = require('mongoose')
const LinkLogic = require('../../../rss/logic/LinkLogic.js')
const dbName = 'test_int_linklogic'
const CON_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
}

describe('Int::structs/db/Blacklist Database', function () {
  beforeAll(async function () {
    await mongoose.connect(`mongodb://localhost:27017/${dbName}`, CON_OPTIONS)
  })
  beforeEach(async function () {
    await mongoose.connection.db.dropDatabase()
  })
  it('updates properties', async function () {
    const articleList = [{
      guid: 'a',
      title: 't1',
      description: 'd1'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: ['title'],
        ncomparisons: ['description']
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    logicData.docs.push({
      id: 'a',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {}
    })
    await mongoose.connection.collection('articles')
      .insertOne(logicData.docs[0])
    const logic = new LinkLogic(logicData)
    await logic.runFromMongo()
    const doc = await mongoose.connection.collection('articles').findOne({
      id: 'a'
    })
    expect(doc.properties).toEqual({
      title: articleList[0].title,
      description: articleList[0].description
    })
  })
  it('sends new articles if new ID', async function () {
    const articleList = [{
      guid: 'a',
      title: 't1'
    }, {
      guid: 'b'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: [],
        ncomparisons: []
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    logicData.docs.push({
      id: 'b',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {}
    })
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(1)
    expect(newArticles[0]).toEqual({
      ...articleList[0],
      _feed: rssList.feedid1
    })
  })
  it('does not send new articles if old ID', async function () {
    const articleList = [{
      guid: 'b'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: [],
        ncomparisons: []
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    logicData.docs.push({
      id: 'b',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {}
    })
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(0)
  })
  it('sends new articles when id exists in DB but pass pcomparison', async function () {
    const articleList = [{
      guid: 'a',
      title: 't1'
    }, {
      guid: 'b',
      title: 't2'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: ['title'],
        ncomparisons: []
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    logicData.docs.push({
      id: 'a',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {
        title: 't1'
      }
    })
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(1)
    expect(newArticles[0]).toEqual({
      ...articleList[1],
      _feed: rssList.feedid1
    })
  })
  it('does not send articles when id is new but ncomparison blocks', async function () {
    const articleList = [{
      guid: 'a',
      title: 't1'
    }, {
      guid: 'b',
      title: 't2'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: [],
        ncomparisons: ['title']
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    logicData.docs.push({
      id: 'b',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {
        title: 't1'
      }
    })
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(0)
  })
  it('does not send new articles when no articles have been stored', async function () {
    const articleList = [{
      guid: 'a',
      title: 't1'
    }, {
      guid: 'b',
      title: 't2'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: [],
        ncomparisons: []
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(0)
  })
  it('inserts new articles to database', async function () {
    const articleList = [{
      guid: 'a',
      title: 't1',
      summary: 's1'
    }, {
      guid: 'b',
      title: 't2',
      summary: 's2'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: [],
        ncomparisons: ['title']
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    const logic = new LinkLogic(logicData)
    await logic.runFromMongo()
    const docs = await mongoose.connection.collection('articles').find().toArray()
    expect(docs).toHaveLength(2)
    expect(docs).toContainEqual(expect.objectContaining({
      id: 'a',
      feedURL: logicData.link,
      scheduleName: logicData.scheduleName,
      shardID: logicData.shardID,
      properties: {
        title: 't1'
      }
    }))
    expect(docs).toContainEqual(expect.objectContaining({
      id: 'b',
      feedURL: logicData.link,
      scheduleName: logicData.scheduleName,
      shardID: logicData.shardID,
      properties: {
        title: 't2'
      }
    }))
  })
  it('does not send new article with old ID but contains a pcomparison value of recently sent article', async function () {
    /**
     * This is when the IDs are within the database. This
     * case is whewn IDs are sen in DB.
     */
    const articleList = [{
      /**
       * This one should not send since the previous
       * article (index 1) already has this title
       */
      guid: 'a',
      title: 't2'
    }, {
      guid: 'b',
      title: 't2'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: ['title'],
        ncomparisons: []
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid'
    }
    logicData.docs = [{
      id: 'a',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {
        title: 'shffgh'
      }
    }, {
      id: 'b',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {}
    }]
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(1)
    expect(newArticles[0]).toEqual(expect.objectContaining(articleList[1]))
  })
  it('does not send new article with new IDs when ncomparison blocked a recent new article', async function () {
    /**
     * The article list is handled in *reverse*. This case
     * is when IDs are not seen in DB
     */
    const articleList = [{
      /**
       * This one should not send, despite the new
       * guid since the previous article (index 1) has same title
       */
      guid: 'aa',
      title: 'ta'
    }, {
      guid: 'bb',
      title: 'ta'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: [],
        ncomparisons: ['title']
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    logicData.docs.push({
      _id: 'a',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {
        title: 't'
      }
    })
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(1)
    expect(newArticles[0]).toEqual(expect.objectContaining(articleList[1]))
  })
  it('sends when at least 1 pcomparison passes if others do not pass', async function () {
    const articleList = [{
      guid: 'aa',
      title: 't',
      description: 'hola'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: ['title', 'description'],
        ncomparisons: []
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    logicData.docs.push({
      _id: 'a',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {
        title: 't',
        description: 'holano'
      }
    })
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(1)
    expect(newArticles[0]).toEqual(expect.objectContaining(articleList[0]))
  })
  it('blocks when at least 1 ncomparison blocks if others pass', async function () {
    const articleList = [{
      guid: 'aa',
      title: 't',
      description: 'hola'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: [],
        ncomparisons: ['title', 'description']
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid',
      docs: []
    }
    logicData.docs.push({
      _id: 'a',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {
        title: 't',
        description: 'holano'
      }
    })
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(0)
  })
  it('does not send articles with old guids that pass pcomparisons if property is uninitialized', async function () {
    const articleList = [{
      guid: 'a',
      title: 't1'
    }, {
      guid: 'b',
      title: 't2'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: ['title'],
        ncomparisons: []
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid'
    }
    logicData.docs = [{
      id: 'a',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {}
    }, {
      id: 'b',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {}
    }]
    const logic = new LinkLogic(logicData)
    const { newArticles } = await logic.runFromMongo()
    expect(newArticles).toHaveLength(0)
  })
  it('deletes irrelevant stored properties', async function () {
    const articleList = [{
      guid: 'a',
      title: 't1'
    }]
    const rssList = {
      feedid1: {
        _id: 'feedid1',
        pcomparisons: [],
        ncomparisons: []
      }
    }
    const logicData = {
      link: 'https://www.example.com',
      shardID: 1,
      scheduleName: 'default',
      config: {
        feeds: {}
      },
      articleList,
      rssList,
      useIdType: 'guid'
    }
    logicData.docs = [{
      id: 'a',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {
        useless1: 'a',
        useless2: 'b'
      }
    }, {
      id: 'b',
      feedURL: logicData.link,
      shardID: logicData.shardID,
      scheduleName: logicData.scheduleName,
      properties: {
        useless1: 'a'
      }
    }]
    const logic = new LinkLogic(logicData)
    await logic.runFromMongo()
    const all = await mongoose.connection.collection('articles').find().toArray()
    for (const item of all) {
      expect(item).toEqual(expect.objectContaining({
        properties: {}
      }))
    }
  })
  afterAll(async function () {
    await mongoose.connection.db.dropDatabase()
    await mongoose.connection.close()
  })
})
