process.env.TEST_ENV = true
const getFeedPlaceholders = require('../../../../../controllers/api/guilds/feeds/getFeedPlaceholders.js')
const feedServices = require('../../../../../services/feed.js')
const createError = require('../../../../../util/createError.js')
const {
  createResponse,
  createNext
} = require('../../../../mocks/express.js')

jest.mock('../../../../../services/feed.js')
jest.mock('../../../../../util/createError.js')
jest.mock('../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/getFeedPlaceholders', function () {
  afterEach(function () {
    feedServices.getFeedPlaceholders.mockReset()
  })
  it('returns the placeholders', async function () {
    const req = {
      feed: {},
      guildData: {}
    }
    const res = createResponse()
    const data = {
      a: 1
    }
    feedServices.getFeedPlaceholders.mockResolvedValue(data)
    const next = createNext()
    await getFeedPlaceholders(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(data)
  })
  it('returns 500 if service fails', async function () {
    const req = {
      feed: {},
      guildData: {}
    }
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const error = new Error('w4ersyg')
    const createdError = 'q3ew2t4r'
    feedServices.getFeedPlaceholders.mockRejectedValue(error)
    createError.mockReturnValue(createdError)
    const next = createNext()
    await getFeedPlaceholders(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(createdError)
  })
  it('calls the service with the right args', async function () {
    const req = {
      feed: {
        url: '2wq34ety6rh'
      },
      guildData: {
        profile: {
          a: 1
        }
      }
    }
    const res = createResponse()
    feedServices.getFeedPlaceholders.mockResolvedValue()
    const next = createNext()
    await getFeedPlaceholders(req, res, next)
    expect(feedServices.getFeedPlaceholders)
      .toHaveBeenCalledWith(req.feed.url, req.guildData.profile)
  })
})
