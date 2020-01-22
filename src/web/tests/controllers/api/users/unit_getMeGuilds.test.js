const userServices = require('../../../../services/user.js')
const getMeGuilds = require('../../../../controllers/api/users/getMeGuilds.js')
const {
  createResponse,
  createNext
} = require('../../../mocks/express.js')

jest.mock('../../../../services/user.js')

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

describe('Unit::controllers/api/users/getMeGuilds', function () {
  afterEach(function () {
    userServices.getGuildsWithPermission.mockReset()
  })
  it('returns the bot if it exists', async function () {
    const guildsData = '23w4ey5rthu'
    userServices.getGuildsWithPermission
      .mockResolvedValue(guildsData)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMeGuilds(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(guildsData)
  })
  it('calls next if the service fails', async function () {
    const error = new Error('wserhy')
    userServices.getGuildsWithPermission
      .mockRejectedValue(error)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMeGuilds(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(error)
  })
})
