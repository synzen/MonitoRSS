process.env.TEST_ENV = true
const checkUserGuildPermission = require('../../middleware/checkUserGuildPermission.js')
const guildServices = require('../../services/guild.js')
const userServices = require('../../services/user.js')
const createError = require('../../util/createError.js')
const {
  createNext
} = require('../mocks/express.js')

jest.mock('../../services/guild.js')
jest.mock('../../services/user.js')
jest.mock('../../util/createError.js')
jest.mock('../../../config.js')

const createRequest = () => ({
  params: {
    guildID: '1243qr5'
  },
  session: {
    identity: {
      id: 123
    }
  }
})

describe('Unit::middleware/checkUserGuildPermission', function () {
  afterEach(function () {
    guildServices.getCachedGuild.mockReset()
    guildServices.getAppData.mockReset()
    userServices.isManagerOfGuild.mockReset()
    createError.mockReset()
  })
  it('returns 404 for unknown guild', async function () {
    const error = { f: 1 }
    createError.mockReturnValue(error)
    guildServices.getCachedGuild.mockResolvedValue(null)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await checkUserGuildPermission(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith(error)
  })
  it('returns 403 for nonmanager', async function () {
    const error = { f: 1 }
    createError.mockReturnValue(error)
    guildServices.getCachedGuild.mockResolvedValue({})
    userServices.isManagerOfGuild.mockResolvedValue(false)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await checkUserGuildPermission(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(error)
  })
  it('injects guild and guildData into req', async function () {
    const guild = { foo: 1 }
    const guildData = { bar: 2 }
    guildServices.getCachedGuild.mockResolvedValue(guild)
    guildServices.getAppData.mockResolvedValue(guildData)
    userServices.isManagerOfGuild.mockResolvedValue(true)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await checkUserGuildPermission(req, res, next)
    expect(req.guild).toEqual(guild)
    expect(req.guildData).toEqual(guildData)
  })
  it('calls next on success', async function () {
    guildServices.getCachedGuild.mockResolvedValue({})
    guildServices.getAppData.mockResolvedValue({})
    userServices.isManagerOfGuild.mockResolvedValue(true)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await checkUserGuildPermission(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })
  it('calls next on error', async function () {
    const error = new Error('aqwsf')
    guildServices.getCachedGuild.mockRejectedValue(error)
    guildServices.getAppData.mockResolvedValue({})
    userServices.isManagerOfGuild.mockResolvedValue(true)
    const req = createRequest()
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const next = createNext()
    await checkUserGuildPermission(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
    next.mockClear()
    await checkUserGuildPermission(req, res, next)
    guildServices.getCachedGuild.mockResolvedValue({})
    guildServices.getAppData.mockRejectedValue(error)
    userServices.isManagerOfGuild.mockResolvedValue(true)
    expect(next).toHaveBeenCalledWith(error)
    next.mockClear()
    await checkUserGuildPermission(req, res, next)
    guildServices.getCachedGuild.mockResolvedValue({})
    guildServices.getAppData.mockResolvedValue({})
    userServices.isManagerOfGuild.mockRejectedValue(error)
    expect(next).toHaveBeenCalledWith(error)
  })
})
