process.env.TEST_ENV = true
const getFeeds = require('../../../../../controllers/api/guilds/feeds/getFeeds.js')
const feedServices = require('../../../../../services/feed.js')
const {
  createResponse,
  createNext
} = require('../../../../mocks/express.js')

jest.mock('../../../../../services/feed.js')
jest.mock('../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/getFeeds', function () {
  afterEach(function () {
    feedServices.getFeedsOfGuild.mockReset()
  })
  it('returns the guild feeds', async function () {
    const req = {
      params: {}
    }
    const res = createResponse()
    const next = createNext()
    const feeds = [1, 2, 3]
    feedServices.getFeedsOfGuild.mockResolvedValue(feeds)
    await getFeeds(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(feeds)
  })
  it('calls the service with the right args', async function () {
    const req = {
      params: {
        guildID: 'q3et5w4r'
      }
    }
    const res = createResponse()
    const next = createNext()
    feedServices.getFeedsOfGuild.mockResolvedValue()
    await getFeeds(req, res, next)
    expect(feedServices.getFeedsOfGuild)
      .toHaveBeenCalledWith(req.params.guildID)
  })
  it('calls next if service throws', async function () {
    const req = {
      params: {}
    }
    const res = createResponse()
    const next = createNext()
    const error = new Error('ewsatgryhdt')
    feedServices.getFeedsOfGuild.mockRejectedValue(error)
    await getFeeds(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
})
