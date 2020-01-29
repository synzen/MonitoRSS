const userServices = require('../../../../services/user.js')
const guildServices = require('../../../../services/guild.js')
const getMeGuilds = require('../../../../controllers/api/users/getMeGuilds.js')
const {
  createResponse,
  createNext
} = require('../../../mocks/express.js')

jest.mock('../../../../services/user.js')
jest.mock('../../../../services/guild.js')

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
    userServices.getGuildsByAPI.mockReset()
    userServices.hasGuildPermission.mockReset()
    guildServices.aggregateDataOfGuild.mockReset()
  })
  it('only returns guilds with permission', async function () {
    const userGuilds = [{}, {
      joe: 'ho'
    }, {}, {}]
    const guildAggregateData = {
      hello: 'world'
    }
    userServices.getGuildsByAPI.mockResolvedValue(userGuilds)
    userServices.hasGuildPermission
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValue(false)
    guildServices.aggregateDataOfGuild
      .mockResolvedValueOnce(guildAggregateData)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMeGuilds(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith([{
      ...userGuilds[1],
      ...guildAggregateData
    }])
  })
  it('calls services with the right args', async function () {
    const userGuilds = [{
      id: '2w3t4e',
      joe: 'ho'
    }]
    const guildAggregateData = {
      hello: 'world'
    }
    userServices.getGuildsByAPI.mockResolvedValue(userGuilds)
    userServices.hasGuildPermission.mockReturnValueOnce(true)
    guildServices.aggregateDataOfGuild.mockResolvedValue(guildAggregateData)
    const req = createRequest()
    const res = createResponse()
    const next = createNext()
    await getMeGuilds(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(userServices.getGuildsByAPI)
      .toHaveBeenCalledWith(123, 'aesgr')
    expect(userServices.hasGuildPermission)
      .toHaveBeenCalledWith(userGuilds[0])
    expect(guildServices.aggregateDataOfGuild)
      .toHaveBeenCalledWith(userGuilds[0].id)
  })
})
