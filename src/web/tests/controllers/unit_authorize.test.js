process.env.TEST_ENV = true
const controller = require('../../controllers/authorize.js')
const authServices = require('../../services/auth.js')
const routingServices = require('../../services/routing.js')
const {
  createRequest,
  createResponse
} = require('../mocks/express.js')

jest.mock('../../services/auth.js')
jest.mock('../../services/routing.js')
jest.mock('request-ip')

describe('Unit::controllers/authorize', function () {
  it('injects the token and identity into session', async function () {
    const session = {
      token: 1,
      identity: 2
    }
    const req = createRequest()
    const res = createResponse()
    authServices.createAuthToken.mockResolvedValue({ ...session })
    await controller(req, res)
    expect(req.session.token).toEqual(session.token)
    expect(req.session.identity).toEqual(session.identity)
  })
  it('redirects to the previously saved route if it exists', async function () {
    const req = createRequest()
    const res = createResponse()
    const savedPath = '32qwt54e6ry5t'
    routingServices.getPath.mockReturnValue(savedPath)
    await controller(req, res)
    expect(res.redirect).toHaveBeenCalledWith(savedPath)
  })
  it('redirects to the /cp if saved route does not exist', async function () {
    const req = createRequest()
    const res = createResponse()
    routingServices.getPath.mockReturnValue(null)
    await controller(req, res)
    expect(res.redirect).toHaveBeenCalledWith('/cp')
  })
  it('redirects to / if createAuthToken fails', async function () {
    const req = createRequest()
    const res = createResponse()
    authServices.createAuthToken.mockRejectedValue(new Error())
    await controller(req, res)
    expect(res.redirect).toHaveBeenCalledWith('/')
  })
})
