const createFeedback = require('../../../controllers/api/createFeedback.js')
const feedbackServices = require('../../../services/feedback.js')
const {
  createResponse,
  createNext
} = require('../../mocks/express.js')

jest.mock('../../../services/feedback.js')

describe('Unit::controllers/api/createFeedback', function () {
  beforeEach(function () {
    feedbackServices.createFeedback.mockReset()
  })
  it('returns the service value', async function () {
    const val = 'w4erydt'
    feedbackServices.createFeedback.mockReturnValue(val)
    const req = {
      body: {},
      session: {
        identity: {}
      }
    }
    const res = createResponse()
    const next = createNext()
    await createFeedback(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(val)
  })
  it('calls the service with the right arg', async function () {
    feedbackServices.createFeedback.mockReturnValue()
    const req = {
      body: {
        content: '12q43e'
      },
      session: {
        identity: {
          id: '2q3wr4e',
          username: 'wsrt'
        }
      }
    }
    const res = createResponse()
    await createFeedback(req, res)
    expect(feedbackServices.createFeedback)
      .toHaveBeenCalledWith(req.session.identity.id, req.session.identity.username, req.body.content)
  })
  it('calls next when service fails', async function () {
    const error = new Error('aesdf')
    feedbackServices.createFeedback.mockRejectedValue(error)
    const req = {
      body: {},
      session: {
        identity: {}
      }
    }
    const res = createResponse()
    const next = createNext()
    await createFeedback(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
})
