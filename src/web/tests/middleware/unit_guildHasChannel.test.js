process.env.TEST_ENV = true
const guildHasChannel = require('../../middleware/guildHasChannel.js')
const guildServices = require('../../services/guild.js')
const createError = require('../../util/createError.js')
const {
  createResponse,
  createNext
} = require('../mocks/express.js')

jest.mock('../../services/guild.js')
jest.mock('../../util/createError.js')
jest.mock('../../../config.js')

const createRequest = () => ({
  params: {
    guildID: '1243qr5'
  },
  body: {
    channel: '2346'
  }
})

describe('Unit::middleware/guildHasChannel', function () {
  afterEach(function () {
    guildServices.guildHasChannel.mockReset()
    createError.mockReset()
  })
  it('returns 404 for unknown channel', async function () {
    const error = { f: 1 }
    createError.mockReturnValue(error)
    guildServices.guildHasChannel.mockResolvedValue(false)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await guildHasChannel(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith(error)
  })
  it('calls next if found channel', async function () {
    guildServices.guildHasChannel.mockResolvedValue(true)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await guildHasChannel(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })
  it('calls next with err if service fails', async function () {
    const error = new Error('wsr')
    guildServices.guildHasChannel.mockRejectedValue(error)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await guildHasChannel(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls guildHasChannel correctly', async function () {
    guildServices.guildHasChannel.mockResolvedValue(true)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await guildHasChannel(req, res, next)
    expect(guildServices.guildHasChannel)
      .toHaveBeenCalledWith('1243qr5', '2346')
  })
})
