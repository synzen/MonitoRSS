process.env.TEST_ENV = true
const feedHasSubscriber = require('../../middleware/feedHasSubscriber.js')
const subscriberServices = require('../../services/subscriber.js')
const createError = require('../../util/createError.js')
const {
  createResponse,
  createNext
} = require('../mocks/express.js')

jest.mock('../../services/subscriber.js')
jest.mock('../../util/createError.js')
jest.mock('../../../config.js')

const createRequest = () => ({
  params: {
    feedID: 'feedID',
    subscriberID: 'subscriberID'
  }
})

describe('Unit::middleware/feedHasSubscriber', function () {
  afterEach(function () {
    subscriberServices.getSubscriberOfFeed.mockReset()
    createError.mockReset()
  })
  it('returns 404 for unknown feed', async function () {
    const error = { f: 1 }
    createError.mockReturnValue(error)
    subscriberServices.getSubscriberOfFeed.mockResolvedValue(null)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await feedHasSubscriber(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith(error)
  })
  it('calls next if found feed', async function () {
    subscriberServices.getSubscriberOfFeed.mockResolvedValue({})
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await feedHasSubscriber(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })
  it('injects feed into req.subscriber', async function () {
    const feed = {
      a: 1
    }
    subscriberServices.getSubscriberOfFeed.mockResolvedValue(feed)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await feedHasSubscriber(req, res, next)
    expect(req.subscriber).toEqual(feed)
  })
  it('calls next with error if service fails', async function () {
    const error = new Error('ewsatg')
    subscriberServices.getSubscriberOfFeed.mockRejectedValue(error)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await feedHasSubscriber(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls service with right args', async function () {
    subscriberServices.getSubscriberOfFeed.mockResolvedValue({})
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await feedHasSubscriber(req, res, next)
    expect(subscriberServices.getSubscriberOfFeed)
      .toHaveBeenCalledWith('feedID', 'subscriberID')
  })
})
