process.env.TEST_ENV = true
const userServices = require('../../../../services/user.js')
const config = require('../../../../../config.js')
const getBot = require('../../../../controllers/api/users/getBot.js')
const createError = require('../../../../util/createError.js')
const {
  createResponse,
  createNext
} = require('../../../mocks/express.js')

jest.mock('../../../../../config.js', () => ({
  get: () => ({
    web: {
      clientID: 'abc123'
    }
  })
}))
jest.mock('../../../../util/createError.js')
jest.mock('../../../../services/user.js')

describe('Unit::controllers/api/users/getBot', function () {
  afterEach(function () {
    userServices.getUser.mockReset()
  })
  it('returns the bot if it exists', async function () {
    const user = '23w4ey5rthu'
    userServices.getUser.mockResolvedValue(user)
    const res = createResponse()
    const next = createNext()
    await getBot({}, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(user)
  })
  it('calls getUser correctly', async function () {
    userServices.getUser.mockResolvedValue()
    const res = createResponse()
    const next = createNext()
    const clientID = config.get().web.clientID
    await getBot({}, res, next)
    expect(userServices.getUser)
      .toHaveBeenCalledTimes(1)
    expect(userServices.getUser)
      .toHaveBeenCalledWith(clientID)
  })
  it('sends the right response if bot not found', async function () {
    userServices.getUser.mockResolvedValue(null)
    const createdError = { s: 1 }
    createError.mockReturnValue(createdError)
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await getBot({}, res, next)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith(createdError)
  })
  it('calls next if getUser fails', async function () {
    const error = new Error('esawtg')
    userServices.getUser.mockRejectedValue(error)
    const res = createResponse()
    const next = createNext()
    await getBot({}, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(error)
  })
})
