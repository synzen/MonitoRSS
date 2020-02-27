process.env.TEST_ENV = true
const getSubscribers = require('../../../../../../controllers/api/guilds/feeds/subscribers/getSubscribers.js')
const subscriberServices = require('../../../../../../services/subscriber.js')
const {
  createNext,
  createResponse
} = require('../../../../../mocks/express.js')

jest.mock('../../../../../../services/subscriber.js')
jest.mock('../../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/subscribers/getSubscribers', function () {
  afterEach(function () {
    subscriberServices.getSubscribersOfFeed.mockReset()
  })
  it('returns the subscribers', async function () {
    const req = {
      params: {}
    }
    const res = createResponse()
    const subscribers = [{
      a: 1
    }, {
      b: 2
    }]
    subscriberServices.getSubscribersOfFeed.mockResolvedValue(subscribers)
    const next = createNext()
    await getSubscribers(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(subscribers)
  })
  it('calls next if service fails', async function () {
    const error = new Error('wtesgr')
    const req = {
      params: {}
    }
    subscriberServices.getSubscribersOfFeed.mockRejectedValue(error)
    const next = createNext()
    await getSubscribers(req, {}, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls the service with the right arg', async function () {
    const req = {
      params: {
        feedID: 'q32ew5t46ry',
        subscriberID: '23w4t5er'
      }
    }
    const res = createResponse()
    subscriberServices.getSubscribersOfFeed.mockResolvedValue()
    const next = createNext()
    await getSubscribers(req, res, next)
    expect(subscriberServices.getSubscribersOfFeed)
      .toHaveBeenCalledWith(req.params.feedID)
  })
})
