process.env.TEST_ENV = true
const fetch = require('node-fetch')
const feedServices = require('../../../../services/feed.js')
const getFeed = require('../../../../controllers/api/feeds/getFeed.js')
const createError = require('../../../../util/createError.js')
const {
  createRequest,
  createResponse,
  createNext
} = require('../../../mocks/express.js')

jest.mock('node-fetch')
jest.mock('../../../../util/createError.js')
jest.mock('../../../../services/feed.js')

describe('Unit::controllers/api/feeds/getFeed', function () {
  afterEach(function () {
    feedServices.getFeedPlaceholders.mockReset()
  })
  it('returns the feeds and xml if it exists', async function () {
    const placeholders = '23w4ey5rthu'
    const xml = 'tewsr'
    const fetchResults = {
      status: 200,
      text: jest.fn(() => xml)
    }
    feedServices.getFeedPlaceholders
      .mockResolvedValue(placeholders)
    fetch.mockResolvedValue(fetchResults)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    const expected = {
      placeholders,
      xml
    }
    await getFeed()(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expected)
  })
  it('returns 400 if invalid feed', async function () {
    const error = new Error('invalid feed')
    feedServices.getFeedPlaceholders.mockRejectedValue(error)
    const createdError = '1243'
    createError.mockReturnValue(createdError)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await getFeed()(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(createdError)
  })
  it('returns a 500 for unknown error when fetching', async function () {
    feedServices.getFeedPlaceholders.mockRejectedValue(new Error())
    const createdError = '1245323'
    createError.mockReturnValue(createdError)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await getFeed()(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(createdError)
  })
  it('returns 500 if fetch gives bad status code', async function () {
    feedServices.getFeedPlaceholders.mockResolvedValue([])
    fetch.mockResolvedValue({ status: 300 })
    const createdError = '1245323'
    createError.mockReturnValue(createdError)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await getFeed()(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(createdError)
  })
  it('returns 500 if fetch gives bad status code', async function () {
    const fetched = {
      status: 200,
      text: jest.fn().mockRejectedValue(new Error())
    }
    feedServices.getFeedPlaceholders.mockResolvedValue([])
    fetch.mockResolvedValue(fetched)
    const createdError = '1245323'
    createError.mockReturnValue(createdError)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await getFeed()(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(createdError)
  })
})
