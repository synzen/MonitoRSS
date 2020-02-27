process.env.TEST_ENV = true
const editSubscriber = require('../../../../../../controllers/api/guilds/feeds/subscribers/editSubscriber.js')
const subscriberServices = require('../../../../../../services/subscriber.js')
const {
  createResponse,
  createNext
} = require('../../../../../mocks/express.js')

jest.mock('../../../../../../services/subscriber.js')
jest.mock('../../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/subscribers/editSubscriber', function () {
  afterEach(function () {
    subscriberServices.editSubscriber.mockReset()
  })
  it('returns the edited subscriber', async function () {
    const req = {
      params: {},
      body: {
        filters: 1
      }
    }
    const res = createResponse()
    const editedSubscriber = { a: 2 }
    subscriberServices.editSubscriber.mockResolvedValue(editedSubscriber)
    const next = createNext()
    await editSubscriber(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(editedSubscriber)
  })
  it('calls next if service fails', async function () {
    const error = new Error('wtesgr')
    const req = {
      params: {},
      body: {
        filters: 1
      }
    }
    subscriberServices.editSubscriber.mockRejectedValue(error)
    const next = createNext()
    await editSubscriber(req, {}, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls the service with the right arg', async function () {
    const req = {
      params: {
        feedID: 'q32ew5t46ry',
        subscriberID: '23w4t5er'
      },
      body: {
        filters: {
          a: 1
        }
      }
    }
    const end = jest.fn()
    const res = {
      status: jest.fn(() => ({ end }))
    }
    subscriberServices.editSubscriber.mockResolvedValue()
    const next = createNext()
    await editSubscriber(req, res, next)
    expect(subscriberServices.editSubscriber)
      .toHaveBeenCalledWith(req.params.feedID, req.params.subscriberID, {
        filters: {
          ...req.body.filters
        }
      })
  })
  it('returns 304 if no filters', async function () {
    const req = {
      params: {},
      body: {
        id: 'q235rwe',
        type: 'sgrf'
      }
    }
    const end = jest.fn()
    const res = {
      status: jest.fn(() => ({ end }))
    }
    const next = createNext()
    await editSubscriber(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(304)
    expect(end).toHaveBeenCalled()
  })
})
