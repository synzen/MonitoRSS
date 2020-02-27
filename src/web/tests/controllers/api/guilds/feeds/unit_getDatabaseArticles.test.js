process.env.TEST_ENV = true
const getDatabaseArticles = require('../../../../../controllers/api/guilds/feeds/getDatabaseArticles.js')
const feedServices = require('../../../../../services/feed.js')
const {
  createResponse,
  createNext
} = require('../../../../mocks/express.js')

jest.mock('../../../../../services/feed.js')
jest.mock('../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/getDatabaseArticles', function () {
  afterEach(function () {
    feedServices.getDatabaseArticles.mockReset()
  })
  it('returns the data', async function () {
    const req = {
      feed: {},
      guild: {}
    }
    const res = createResponse()
    const next = createNext()
    const data = {
      what: 1
    }
    feedServices.getDatabaseArticles.mockResolvedValue(data)
    await getDatabaseArticles(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(data)
  })
  it('calls next if service fails', async function () {
    const req = {
      feed: {},
      guild: {}
    }
    const res = createResponse()
    const next = createNext()
    const error = new Error('wsedgrfhd')
    feedServices.getDatabaseArticles.mockRejectedValue(error)
    await getDatabaseArticles(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls the service with the right args', async function () {
    const req = {
      feed: {
        url: 'qe3wt463rg'
      },
      guild: {
        shard: 2333
      }
    }
    const res = createResponse()
    const next = createNext()
    const data = {
      what: 1
    }
    feedServices.getDatabaseArticles.mockResolvedValue(data)
    await getDatabaseArticles(req, res, next)
    expect(feedServices.getDatabaseArticles)
      .toHaveBeenCalledWith(req.feed, req.guild.shard)
  })
})
