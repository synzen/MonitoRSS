const editGuild = require('../../../../controllers/api/guilds/editGuild.js')
const guildServices = require('../../../../services/guild.js')
const {
  createResponse,
  createNext
} = require('../../../mocks/express.js')

jest.mock('../../../../services/guild.js')

describe('Unit::controllers/api/guilds', function () {
  afterEach(function () {
    guildServices.updateProfile.mockReset()
  })
  it('calls updateProfile', async function () {
    const req = {
      guild: {
        id: 123,
        name: 'aedg'
      },
      body: {}
    }
    const res = createResponse()
    const next = createNext()
    await editGuild(req, res, next)
    expect(guildServices.updateProfile)
      .toHaveBeenCalledWith(req.guild.id, req.guild.name, {})
  })
  it('calls updateProfile with updated values correctly', async function () {
    const req = {
      guild: {},
      body: {
        fo: 1,
        dateLanguage: 1,
        prefix: '',
        alert: 3,
        dateFormat: '',
        locale: 5,
        timezone: 6
      }
    }
    const res = createResponse()
    const next = createNext()
    await editGuild(req, res, next)
    const updatedValues = {
      ...req.body,
      prefix: undefined,
      dateFormat: undefined
    }
    delete updatedValues.fo
    expect(guildServices.updateProfile)
      .toHaveBeenCalledWith(req.guild.id, req.guild.name, updatedValues)
  })
  it('returns the updated profile', async function () {
    const updatedProfile = {
      foo: 'bar'
    }
    guildServices.updateProfile.mockResolvedValue(updatedProfile)
    const req = {
      guild: {},
      body: {}
    }
    const res = createResponse()
    const next = createNext()
    await editGuild(req, res, next)
    expect(res.json).toHaveBeenCalledWith(updatedProfile)
  })
  it('calls next if update fails', async function () {
    const error = new Error('heloz')
    guildServices.updateProfile.mockRejectedValue(error)
    const req = {
      guild: {},
      body: {}
    }
    const res = createResponse()
    const next = createNext()
    await editGuild(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
})
