const getGuild = require('../../../../controllers/api/guilds/getGuild.js')
const {
  createResponse,
  createNext
} = require('../../../mocks/express.js')

describe('Unit::controllers/api/guilds', function () {
  it('returns the profile if it exists', function () {
    const req = {
      guildData: {
        profile: 123
      }
    }
    const res = createResponse()
    const next = createNext()
    getGuild(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(req.guildData.profile)
  })
  it('returns an empty profile if it does not exist', function () {
    const req = {}
    const res = createResponse()
    const next = createNext()
    getGuild(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({})
  })
})
