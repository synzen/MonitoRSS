process.env.TEST_ENV = true
const guildHasChannel = require('../../middleware/guildHasChannel.js')
const guildHasChannelOptional = require('../../middleware/guildHasChannelOptional.js')
const {
  createNext
} = require('../mocks/express.js')

jest.mock('../../middleware/guildHasChannel.js')
jest.mock('../../../config.js')

describe('Unit::middleware/guildHasChannelOptional', function () {
  afterEach(function () {
    guildHasChannel.mockReset()
  })
  it('calls guildHasChannel middleware if channel id exists', async function () {
    const req = {
      body: {
        channelID: '2354t'
      }
    }
    const next = createNext()
    guildHasChannelOptional(req, {}, next)
    expect(next).not.toHaveBeenCalled()
    expect(guildHasChannel).toHaveBeenCalled()
  })
  it('calls next middleware if channel id does not exists', async function () {
    const req = {
      body: {}
    }
    const next = createNext()
    guildHasChannelOptional(req, {}, next)
    expect(next).toHaveBeenCalledWith()
  })
})
