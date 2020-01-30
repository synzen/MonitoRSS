const getRoles = require('../../../../../controllers/api/guilds/roles/getRoles.js')
const roleServices = require('../../../../../services/role.js')
const {
  createResponse,
  createNext
} = require('../../../../mocks/express.js')

jest.mock('../../../../../services/role.js')

describe('Unit::controllers/api/guilds/channels/getRoles', function () {
  afterEach(function () {
    roleServices.getRolesOfGuild.mockReset()
  })
  it('returns the channels', async function () {
    const req = {
      params: {}
    }
    const res = createResponse()
    const data = [1, 2, 3]
    roleServices.getRolesOfGuild.mockResolvedValue(data)
    const next = createNext()
    await getRoles(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(data)
  })
  it('calls next if service fails', async function () {
    const req = {
      params: {}
    }
    const res = createResponse()
    const error = new Error('wsetgd')
    roleServices.getRolesOfGuild.mockRejectedValue(error)
    const next = createNext()
    await getRoles(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls service with right arg', async function () {
    const req = {
      params: {
        guildID: '3q12e5tw4ry'
      }
    }
    const res = createResponse()
    roleServices.getRolesOfGuild.mockResolvedValue([])
    const next = createNext()
    await getRoles(req, res, next)
    expect(roleServices.getRolesOfGuild)
      .toHaveBeenCalledWith(req.params.guildID)
  })
})
