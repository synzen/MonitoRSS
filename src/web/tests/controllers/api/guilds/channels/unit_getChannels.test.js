const getChannels = require('../../../../../controllers/api/guilds/channels/getChannels')
const channelServices = require('../../../../../services/channel.js')
const {
  createResponse,
  createNext
} = require('../../../../mocks/express.js')

jest.mock('../../../../../services/channel.js')

describe('Unit::controllers/api/guilds/channels/getChannels', function () {
  afterEach(function () {
    channelServices.getGuildChannels.mockReset()
  })
  it('returns the channels', async function () {
    const req = {
      params: {}
    }
    const res = createResponse()
    const data = [1, 2, 3]
    channelServices.getGuildChannels.mockResolvedValue(data)
    const next = createNext()
    await getChannels(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(data)
  })
  it('calls next if service fails', async function () {
    const req = {
      params: {}
    }
    const res = createResponse()
    const error = new Error('wsetgd')
    channelServices.getGuildChannels.mockRejectedValue(error)
    const next = createNext()
    await getChannels(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls service with right arg', async function () {
    const req = {
      params: {
        guildID: '3q12e5tw4ry'
      }
    }
    const res = createResponse()
    channelServices.getGuildChannels.mockResolvedValue([])
    const next = createNext()
    await getChannels(req, res, next)
    expect(channelServices.getGuildChannels)
      .toHaveBeenCalledWith(req.params.guildID)
  })
})
