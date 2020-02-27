process.env.TEST_ENV = true
const guildHasFeed = require('../../middleware/guildHasFeed.js')
const feedServices = require('../../services/feed.js')
const createError = require('../../util/createError.js')
const {
  createResponse,
  createNext
} = require('../mocks/express.js')

jest.mock('../../services/feed.js')
jest.mock('../../util/createError.js')
jest.mock('../../../config.js')

const createRequest = () => ({
  params: {
    guildID: '1243qr5',
    feedID: 'feedID'
  }
})

describe('Unit::middleware/guildHasFeed', function () {
  afterEach(function () {
    feedServices.getFeedOfGuild.mockReset()
    createError.mockReset()
  })
  it('returns 404 for unknown feed', async function () {
    const error = { f: 1 }
    createError.mockReturnValue(error)
    feedServices.getFeedOfGuild.mockResolvedValue(null)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await guildHasFeed(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith(error)
  })
  it('calls next if found feed', async function () {
    feedServices.getFeedOfGuild.mockResolvedValue({})
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await guildHasFeed(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })
  it('injects feed into req.feed', async function () {
    const feed = {
      a: 1
    }
    feedServices.getFeedOfGuild.mockResolvedValue(feed)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await guildHasFeed(req, res, next)
    expect(req.feed).toEqual(feed)
  })
  it('calls next with error if service fails', async function () {
    const error = new Error('ewsatg')
    feedServices.getFeedOfGuild.mockRejectedValue(error)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await guildHasFeed(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls service with right args', async function () {
    feedServices.getFeedOfGuild.mockResolvedValue({})
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await guildHasFeed(req, res, next)
    expect(feedServices.getFeedOfGuild)
      .toHaveBeenCalledWith('1243qr5', 'feedID')
  })
})
