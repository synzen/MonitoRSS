process.env.TEST_ENV = true
const deleteSubscriber = require('../../../../../../controllers/api/guilds/feeds/subscribers/deleteSubscriber.js')
const subscriberServices = require('../../../../../../services/subscriber.js')
const {
  createNext
} = require('../../../../../mocks/express.js')

jest.mock('../../../../../../services/subscriber.js')
jest.mock('../../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/subscribers/deleteSubscriber', function () {
  afterEach(function () {
    subscriberServices.deleteSubscriberOfFeed.mockReset()
  })
  it('returns 204 if deleted', async function () {
    const req = {
      params: {}
    }
    const end = jest.fn()
    const res = {
      status: jest.fn(() => ({ end }))
    }
    subscriberServices.deleteSubscriberOfFeed.mockResolvedValue()
    const next = createNext()
    await deleteSubscriber(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(204)
    expect(end).toHaveBeenCalledWith()
  })
  it('calls next if service fails', async function () {
    const error = new Error('wtesgr')
    const req = {
      params: {}
    }
    subscriberServices.deleteSubscriberOfFeed.mockRejectedValue(error)
    const next = createNext()
    await deleteSubscriber(req, {}, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls the service with the right arg', async function () {
    const req = {
      params: {
        feedID: 'q32ew5t46ry',
        subscriberID: '23w4t5er'
      }
    }
    const end = jest.fn()
    const res = {
      status: jest.fn(() => ({ end }))
    }
    subscriberServices.deleteSubscriberOfFeed.mockResolvedValue()
    const next = createNext()
    await deleteSubscriber(req, res, next)
    expect(subscriberServices.deleteSubscriberOfFeed)
      .toHaveBeenCalledWith(req.params.feedID, req.params.subscriberID)
  })
})
