process.env.TEST_ENV = true
const editGuild = require('../../../../controllers/api/guilds/editGuild.js')
const guildServices = require('../../../../services/guild.js')
const {
  createResponse,
  createNext
} = require('../../../mocks/express.js')

jest.mock('../../../../services/guild.js')
jest.mock('../../../../../config.js')

describe('Unit::controllers/api/guilds', function () {
  afterEach(function () {
    guildServices.updateProfile.mockReset()
    guildServices.getGuild.mockReset()
  })
  it('calls updateProfile', async function () {
    const req = {
      guild: {
        id: 123,
        name: 'aedg'
      },
      body: {
        prefix: 1
      }
    }
    const res = createResponse()
    const next = createNext()
    await editGuild(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(guildServices.updateProfile)
      .toHaveBeenCalledWith(req.guild.id, req.guild.name, {
        prefix: req.body.prefix
      })
  })
  it('calls updateProfile with updated values correctly', async function () {
    const req = {
      guild: {},
      body: {
        fo: 1,
        dateLanguage: 1,
        prefix: '',
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
  it('returns the updated guild data', async function () {
    const updatedProfile = {
      foo: 'bar'
    }
    guildServices.updateProfile.mockResolvedValue()
    guildServices.getGuild.mockResolvedValue(updatedProfile)
    const req = {
      guild: {},
      body: {
        prefix: 1
      }
    }
    const res = createResponse()
    const next = createNext()
    await editGuild(req, res, next)
    expect(res.json).toHaveBeenCalledWith(updatedProfile)
  })
  it('calls next if update fails', async function () {
    const error = new Error('heloz')
    guildServices.updateProfile.mockRejectedValue(error)
    guildServices.getGuild.mockResolvedValue()
    const req = {
      guild: {},
      body: {
        prefix: 1
      }
    }
    const res = createResponse()
    const next = createNext()
    await editGuild(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls next ig getGuild fails', async function () {
    const error = new Error('heloz')
    guildServices.updateProfile.mockResolvedValue()
    guildServices.getGuild.mockRejectedValue(error)
    const req = {
      guild: {},
      body: {
        prefix: 1
      }
    }
    const res = createResponse()
    const next = createNext()
    await editGuild(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('returns 304 if nothing to update', async function () {
    guildServices.updateProfile.mockResolvedValue()
    const req = {
      guild: {},
      body: {
        prefixxx: 1,
        whatever: 2
      }
    }
    const end = jest.fn()
    const res = {
      status: jest.fn(() => ({ end }))
    }
    const next = createNext()
    await editGuild(req, res, next)
    expect(res.status).toHaveBeenCalledWith(304)
    expect(end).toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })
})
