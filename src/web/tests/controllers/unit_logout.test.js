process.env.TEST_ENV = true
const controller = require('../../controllers/logout.js')
const authServices = require('../../services/auth.js')
const {
  createRequest,
  createNext
} = require('../mocks/express.js')

jest.mock('../../services/auth.js')
jest.mock('../../../config.js')

describe('Unit::controllers/logout', function () {
  beforeEach(function () {
    authServices.logout.mockRestore()
  })
  it('calls authServices logout', async function () {
    const req = createRequest()
    const next = createNext()
    const oauthClient = 1243
    req.app.get.mockReturnValue(oauthClient)
    req.session = 'abc'
    await controller(req, {}, next)
    expect(authServices.logout)
      .toHaveBeenCalledWith(oauthClient, req.session)
  })
  it('calls next if logout errors', async function () {
    const req = createRequest()
    const next = createNext()
    const error = new Error('hasdf')
    authServices.logout.mockRejectedValue(error)
    await controller(req, {}, next)
    expect(next).toHaveBeenCalledWith(error)
  })
})
