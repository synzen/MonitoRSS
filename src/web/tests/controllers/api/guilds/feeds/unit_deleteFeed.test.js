process.env.TEST_ENV = true
const deleteFeed = require('../../../../../controllers/api/guilds/feeds/deleteFeed.js')
const feedServices = require('../../../../../services/feed.js')
const {
  createNext
} = require('../../../../mocks/express.js')

jest.mock('../../../../../services/feed.js')
jest.mock('../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/deleteFeed', function () {
  afterEach(function () {
    feedServices.deleteFeed.mockReset()
  })
  it('returns 204 if deleted', async function () {
    const req = {
      params: {}
    }
    const end = jest.fn()
    const res = {
      status: jest.fn(() => ({ end }))
    }
    feedServices.deleteFeed.mockResolvedValue()
    const next = createNext()
    await deleteFeed(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(204)
    expect(end).toHaveBeenCalledWith()
  })
  it('calls next if service fails', async function () {
    const error = new Error('wtesgr')
    const req = {
      params: {}
    }
    feedServices.deleteFeed.mockRejectedValue(error)
    const next = createNext()
    await deleteFeed(req, {}, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls the service with the right arg', async function () {
    const req = {
      params: {
        feedID: 'q32ew5t46ry'
      }
    }
    const end = jest.fn()
    const res = {
      status: jest.fn(() => ({ end }))
    }
    feedServices.deleteFeed.mockResolvedValue()
    const next = createNext()
    await deleteFeed(req, res, next)
    expect(feedServices.deleteFeed)
      .toHaveBeenCalledWith(req.params.feedID)
  })
})
