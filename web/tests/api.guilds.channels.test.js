/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

// const agent = request.agent(app())
const httpMocks = require('node-mocks-http')
const redisOps = require('../../util/redisOps.js')
const channelsRoute = require('../routes/api/guilds.channels.js')

jest.mock('../../util/redisOps.js')

describe('/api/guilds/:guildId/channels', function () {
  const userId = 'georgie'
  const session = {
    identity: {
      id: userId
    }
  }
  const params = {
    guildId: '9887'
  }
  describe('GET /', function () {
    afterEach(function () {
      redisOps.channels.getChannelsOfGuild.mockReset()
      redisOps.channels.getName.mockReset()
    })
    it('returns guild channels with their names', async function () {
      const request = httpMocks.createRequest({ session, params })
      const response = httpMocks.createResponse()
      const expectedResponse = [{ id: '1', name: 'name1' }, { id: '2', name: 'name2' }]
      redisOps.channels.getChannelsOfGuild.mockResolvedValueOnce([expectedResponse[0].id, expectedResponse[1].id])
      redisOps.channels.getName.mockResolvedValueOnce(expectedResponse[0].name)
      redisOps.channels.getName.mockResolvedValueOnce(expectedResponse[1].name)
      await channelsRoute.routes.getChannels(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
    it('returns empty array if no channels found', async function () {
      const request = httpMocks.createRequest({ session, params })
      const response = httpMocks.createResponse()
      const expectedResponse = []
      redisOps.channels.getChannelsOfGuild.mockResolvedValueOnce(expectedResponse)
      await channelsRoute.routes.getChannels(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
  })
  describe('GET /:channelId', function () {
    afterEach(function () {
      redisOps.channels.isChannelOfGuild.mockReset()
      redisOps.channels.getName.mockReset()
    })
    it('returns the channel if it is part of guild and cached', async function () {
      const channelId = '235trg'
      const channelName = 'adegs'
      const expectedResponse = { id: channelId, name: channelName }
      const request = httpMocks.createRequest({ session, params: { ...params, channelId } })
      const response = httpMocks.createResponse()
      redisOps.channels.isChannelOfGuild.mockResolvedValueOnce(true)
      redisOps.channels.getName.mockResolvedValueOnce(channelName)
      await channelsRoute.routes.getChannelWithId(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
    it('returns 404 if not part of guild', async function () {
      const channelId = '235trg'
      const request = httpMocks.createRequest({ session, params: { ...params, channelId } })
      const response = httpMocks.createResponse()
      redisOps.channels.isChannelOfGuild.mockResolvedValueOnce(false)
      await channelsRoute.routes.getChannelWithId(request, response)
      expect(response.statusCode).toEqual(404)
      const data = JSON.parse(response._getData())
      expect(data.message.includes('Not found')).toEqual(true)
    })
  })
  // const discordAPIRoutes = [
  //   { route: `/guilds/${guildId}`, response: { owner_id: userId } },
  //   { route: `/guilds/${guildId}/roles`, response: [] },
  //   { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [] } }
  // ]
  // beforeEach(function () {
  //   discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
  //   return models.GuildRss().deleteOne({ id: guildId })
  // })
  // beforeAll(async function (done) {
  //   agent
  //     .post('/session')
  //     .send({
  //       auth: { access_token: 'humpdy dumpdy' },
  //       identity: { id: userId }
  //     })
  //     .expect(200, done)
  // })

  // describe('GET /', function () {
  //   it('returns channels response from discord if 200 code', function (done) {
  //     const discordResponse = { code: 200, message: { ho: 'dunk', fo: 'dur' } }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/guilds/${guildId}/channels`)
  //       .reply(discordResponse.code, discordResponse)

  //     agent
  //       .get(`/api/guilds/${guildId}/channels`)
  //       .expect(discordResponse.code, discordResponse, done)
  //   })
  //   it('returns channels response from discord if non-200 code', function (done) {
  //     const discordResponse = { code: 405, message: { ho: 'dunk', fo: 'dur' } }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/guilds/${guildId}/channels`)
  //       .reply(discordResponse.code, discordResponse)

  //     agent
  //       .get(`/api/guilds/${guildId}/channels`)
  //       .expect(discordResponse.code, { ...discordResponse, discord: true }, done)
  //   })
  // })

  // describe('GET /:channelId', function () {
  //   it('gives back the channel response from discord', function (done) {
  //     const channelId = `azsdfepgjmkgsdxcfgb`
  //     const discordResponse = { elon: 'is', the: 'future?', guild_id: guildId }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/channels/${channelId}`)
  //       .reply(200, discordResponse)

  //     agent
  //       .get(`/api/guilds/${guildId}/channels/${channelId}`)
  //       .expect(200, discordResponse, done)
  //   })
  //   it('returns a 403 code for a channel not in guild', function (done) {
  //     const channelId = `azsdfepgb`
  //     const discordResponse = { elon: 'is', the: 'future?', guild_id: guildId + 1 }
  //     const expectedResponse = { code: 403, message: { channel: 'Not part of guild' } }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/channels/${channelId}`)
  //       .reply(200, discordResponse)

  //     agent
  //       .get(`/api/guilds/${guildId}/channels/${channelId}`)
  //       .expect(expectedResponse.code, expectedResponse, done)
  //   })
  //   it(`returns discord's status code and message for channel not in guild`, function (done) {
  //     const channelId = `azsdfepgb`
  //     const expectedResponse = { code: 450, message: 'no!' }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/channels/${channelId}`)
  //       .reply(expectedResponse.code, expectedResponse)

  //     agent
  //       .get(`/api/guilds/${guildId}/channels/${channelId}`)
  //       .expect(expectedResponse.code, { ...expectedResponse, discord: true }, done)
  //   })
  // })

  // afterAll(function () {
  //   return models.GuildRss().deleteOne({ id: guildId })
  // })
})
