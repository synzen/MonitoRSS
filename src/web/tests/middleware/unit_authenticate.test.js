process.env.TEST_ENV = true
const authenticate = require('../../middleware/authenticate.js')
const authServices = require('../../services/auth.js')
const createError = require('../../util/createError.js')
const {
  createRequest,
  createNext
} = require('../mocks/express.js')

jest.mock('../../services/auth.js')
jest.mock('../../util/createError.js')
jest.mock('../../../config.js')

describe('Unit::middleware/authenticate', function () {
  it('returns a 401 with the error if no token on session', async function () {
    const req = createRequest()
    req.session.token = null
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const error = 'q32wt54e6rye5'
    createError.mockReturnValue(error)
    await authenticate(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith(error)
  })
  it('calls next if getAuthToken succeeds', async function () {
    const req = createRequest()
    const res = {
      app: {
        get: jest.fn()
      }
    }
    const next = createNext()
    req.session.token = { token: 1 }
    authServices.getAuthToken.mockResolvedValue({})
    await authenticate(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })
  it('calls next with the error if get token fails', async function () {
    const req = createRequest()
    const res = {
      app: {
        get: jest.fn()
      }
    }
    const next = createNext()
    req.session.token = { token: 1 }
    const error = new Error('ruh roh')
    authServices.getAuthToken.mockRejectedValue(error)
    await authenticate(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
})
