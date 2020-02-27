process.env.TEST_ENV = true
const userServices = require('../../../../services/user.js')
const getMe = require('../../../../controllers/api/users/getMe.js')
const {
  createResponse,
  createNext
} = require('../../../mocks/express.js')

jest.mock('../../../../services/user.js')
jest.mock('../../../../../config.js')

const createRequest = () => ({
  session: {
    identity: {
      id: 123
    },
    token: {
      access_token: 'aesgr'
    }
  }
})

describe('Unit::controllers/api/users/getMe', function () {
  afterEach(function () {
    userServices.getUser.mockReset()
    userServices.getUserByAPI.mockReset()
  })
  it('returns the user from cache if it exists', async function () {
    const user = '23w4ey5rthu'
    userServices.getUser.mockResolvedValue(user)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMe(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(user)
  })
  it('calls getUser correctly', async function () {
    const user = '23w4ey5rthu'
    userServices.getUser.mockResolvedValue(user)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMe(req, res, next)
    expect(userServices.getUser)
      .toHaveBeenCalledTimes(1)
    expect(userServices.getUser)
      .toHaveBeenCalledWith(req.session.identity.id)
  })
  it('calls getUserByAPI correctly', async function () {
    userServices.getUser.mockResolvedValue(null)
    userServices.getUserByAPI.mockResolvedValue({})
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMe(req, res, next)
    const session = req.session
    expect(userServices.getUserByAPI)
      .toHaveBeenCalledTimes(1)
    expect(userServices.getUserByAPI)
      .toHaveBeenCalledWith(session.identity.id, session.token.access_token)
  })
  it('returns data from api if cache is unavailable', async function () {
    const user = 'zzzzzzz'
    userServices.getUser.mockResolvedValue(null)
    userServices.getUserByAPI.mockResolvedValue(user)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMe(req, res, next)
    expect(res.json).toHaveBeenCalledWith(user)
  })
  it('calls next if getUser fails', async function () {
    const error = new Error('wsr')
    userServices.getUser.mockRejectedValue(error)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMe(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls next if getUserByAPI fails', async function () {
    const error = new Error('wsr')
    userServices.getUser.mockResolvedValue(null)
    userServices.getUserByAPI.mockRejectedValue(error)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMe(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(error)
  })
})
