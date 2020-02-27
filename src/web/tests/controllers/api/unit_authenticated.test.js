process.env.TEST_ENV = true
const authenticated = require('../../../controllers/api/authenticated.js')
const authServices = require('../../../services/auth.js')
const {
  createRequest,
  createResponse
} = require('../../mocks/express.js')

jest.mock('../../../services/auth.js')
jest.mock('../../../../config.js')

describe('Unit::controllers/api/authenticated', function () {
  beforeEach(function () {
    authServices.isAuthenticated.mockReset()
  })
  it('returns the service value', function () {
    const val = 'w4erydt'
    authServices.isAuthenticated.mockReturnValue(val)
    const req = createRequest()
    const res = createResponse()
    authenticated(req, res)
    expect(res.json).toHaveBeenCalledWith({
      authenticated: val
    })
  })
  it('calls the service with the right arg', function () {
    authServices.isAuthenticated.mockReturnValue()
    const req = {
      session: {
        a: 1,
        b: 2
      }
    }
    const res = createResponse()
    authenticated(req, res)
    expect(authServices.isAuthenticated)
      .toHaveBeenCalledWith(req.session)
  })
})
