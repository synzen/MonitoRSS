process.env.TEST_ENV = true
const controller = require('../../controllers/login.js')
const authServices = require('../../services/auth.js')
const {
  createRequest,
  createResponse,
  createNext
} = require('../mocks/express.js')

jest.mock('../../services/auth.js')
jest.mock('../../../config.js')

describe('Unit::controllers/login', function () {
  it('redirects the user to the auth url', function () {
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    const url = '2w3t46ery5'
    authServices.getAuthorizationURL.mockReturnValue(url)
    controller(req, res, next)
    expect(res.redirect).toHaveBeenCalledWith(url)
  })
})
