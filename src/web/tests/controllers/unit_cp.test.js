process.env.TEST_ENV = true
const requestIp = require('request-ip')
const controller = require('../../controllers/cp.js')
const authServices = require('../../services/auth.js')
const routingServices = require('../../services/routing.js')
const htmlConstants = require('../../constants/html.js')
const {
  createRequest
} = require('../mocks/express.js')

jest.mock('request-ip')
jest.mock('../../services/auth.js')
jest.mock('../../services/routing.js')
jest.mock('../../constants/html.js')
jest.mock('../../../config.js')

describe('Unit::controllers/cp', function () {
  afterEach(function () {
    routingServices.setPath.mockRestore()
  })
  it('sets the path if user tries to access cp while not authed', function () {
    const req = createRequest()
    const res = {
      type: jest.fn(() => ({ send: jest.fn() }))
    }
    const ip = '43y5t'
    req.path = 'hello'
    authServices.isAuthenticated.mockReturnValue(false)
    requestIp.getClientIp.mockReturnValue(ip)
    controller(req, res)
    expect(routingServices.setPath).toHaveBeenCalledWith(ip, req.path)
  })
  it('does not save path if user is auth', function () {
    const req = createRequest()
    const res = {
      type: jest.fn(() => ({ send: jest.fn() }))
    }
    authServices.isAuthenticated.mockReturnValue(true)
    controller(req, res)
    expect(routingServices.setPath).not.toHaveBeenCalled()
  })
  it('removes OG  title and OG description', function () {
    const send = jest.fn()
    const req = createRequest()
    const res = {
      type: jest.fn(() => ({ send }))
    }
    authServices.isAuthenticated.mockReturnValue(true)
    const ovalue = htmlConstants.indexFile
    htmlConstants.indexFile = '__OG_TITLE__ aa __OG_DESCRIPTION__'
    controller(req, res)
    const sent = send.mock.calls[0]
    expect(sent).toEqual(expect.not.stringContaining('__OG_TITLE__'))
    expect(sent).toEqual(expect.not.stringContaining('__OG_DESCRIPTION__'))
    htmlConstants.indexFile = ovalue
  })
})
