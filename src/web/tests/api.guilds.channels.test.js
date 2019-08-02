/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

// const agent = request.agent(app())
const httpMocks = require('node-mocks-http')
const channelsRoute = require('../routes/api/guilds.channels.js')
const RedisChannel = require('../../structs/db/Redis/Channel.js')

jest.mock('../../structs/db/Redis/Channel.js')

RedisChannel.utils = {
  getChannelsOfGuild: jest.fn(() => Promise.resolve())
}

describe('/api/guilds/:guildID/channels', function () {
  const userID = 'georgie'
  const session = {
    identity: {
      id: userID
    }
  }
  const params = {
    guildID: '9887'
  }
  describe('GET /', function () {
    afterEach(function () {
      RedisChannel.fetch.mockReset()
      RedisChannel.utils.getChannelsOfGuild.mockReset()
    })
    it('returns guild channels with their names', async function () {
      const request = httpMocks.createRequest({ session, params })
      const response = httpMocks.createResponse()
      const expectedResponse = [{ id: '1', name: 'name1' }, { id: '2', name: 'name2' }]
      RedisChannel.utils.getChannelsOfGuild.mockResolvedValueOnce(expectedResponse.map(item => item.id))
      for (const expected of expectedResponse) {
        RedisChannel.fetch.mockResolvedValueOnce({ ...expected, toJSON: () => expected })
      }
      await channelsRoute.routes.getChannels(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
    it('returns empty array if no channels found', async function () {
      const request = httpMocks.createRequest({ session, params })
      const response = httpMocks.createResponse()
      const expectedResponse = []
      RedisChannel.utils.getChannelsOfGuild.mockResolvedValueOnce(expectedResponse)
      await channelsRoute.routes.getChannels(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
  })
  describe('GET /:channelID', function () {
    it('returns the channel if it is part of guild and cached', async function () {
      const channelID = '235trg'
      const channelName = 'adegs'
      const expectedResponse = { id: channelID, name: channelName, guildID: params.guildID }
      const request = httpMocks.createRequest({ session, params: { ...params, channelID } })
      const response = httpMocks.createResponse()
      RedisChannel.fetch.mockResolvedValueOnce({ ...expectedResponse, toJSON: () => expectedResponse })
      await channelsRoute.routes.getChannelWithID(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
    it('returns 404 if not found', async function () {
      const channelID = '235trg'
      const request = httpMocks.createRequest({ session, params: { ...params, channelID } })
      const response = httpMocks.createResponse()
      RedisChannel.fetch.mockResolvedValueOnce(null)
      await channelsRoute.routes.getChannelWithID(request, response)
      expect(response.statusCode).toEqual(404)
      const data = JSON.parse(response._getData())
      expect(data.message.includes('Not found')).toEqual(true)
    })
    it('returns 403 if found but not part of guild', async function () {
      const channelID = '235trg'
      const request = httpMocks.createRequest({ session, params: { ...params, channelID } })
      const response = httpMocks.createResponse()
      RedisChannel.fetch.mockResolvedValueOnce({ id: channelID, guildID: params.guildID + 'abc' })
      await channelsRoute.routes.getChannelWithID(request, response)
      expect(response.statusCode).toEqual(403)
      const data = JSON.parse(response._getData())
      expect(data.message.includes('Forbidden')).toEqual(true)
    })
  })
  // const discordAPIRoutes = [
  //   { route: `/guilds/${guildID}`, response: { owner_id: userID } },
  //   { route: `/guilds/${guildID}/roles`, response: [] },
  //   { route: `/guilds/${guildID}/members/${userID}`, response: { roles: [] } }
  // ]
  // beforeEach(function () {
  //   discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
  //   return models.GuildRss().deleteOne({ id: guildID })
  // })
  // beforeAll(async function (done) {
  //   agent
  //     .post('/session')
  //     .send({
  //       auth: { access_token: 'humpdy dumpdy' },
  //       identity: { id: userID }
  //     })
  //     .expect(200, done)
  // })

  // describe('GET /', function () {
  //   it('returns channels response from discord if 200 code', function (done) {
  //     const discordResponse = { code: 200, message: { ho: 'dunk', fo: 'dur' } }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/guilds/${guildID}/channels`)
  //       .reply(discordResponse.code, discordResponse)

  //     agent
  //       .get(`/api/guilds/${guildID}/channels`)
  //       .expect(discordResponse.code, discordResponse, done)
  //   })
  //   it('returns channels response from discord if non-200 code', function (done) {
  //     const discordResponse = { code: 405, message: { ho: 'dunk', fo: 'dur' } }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/guilds/${guildID}/channels`)
  //       .reply(discordResponse.code, discordResponse)

  //     agent
  //       .get(`/api/guilds/${guildID}/channels`)
  //       .expect(discordResponse.code, { ...discordResponse, discord: true }, done)
  //   })
  // })

  // describe('GET /:channelID', function () {
  //   it('gives back the channel response from discord', function (done) {
  //     const channelID = `azsdfepgjmkgsdxcfgb`
  //     const discordResponse = { elon: 'is', the: 'future?', guild_id: guildID }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/channels/${channelID}`)
  //       .reply(200, discordResponse)

  //     agent
  //       .get(`/api/guilds/${guildID}/channels/${channelID}`)
  //       .expect(200, discordResponse, done)
  //   })
  //   it('returns a 403 code for a channel not in guild', function (done) {
  //     const channelID = `azsdfepgb`
  //     const discordResponse = { elon: 'is', the: 'future?', guild_id: guildID + 1 }
  //     const expectedResponse = { code: 403, message: { channel: 'Not part of guild' } }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/channels/${channelID}`)
  //       .reply(200, discordResponse)

  //     agent
  //       .get(`/api/guilds/${guildID}/channels/${channelID}`)
  //       .expect(expectedResponse.code, expectedResponse, done)
  //   })
  //   it(`returns discord's status code and message for channel not in guild`, function (done) {
  //     const channelID = `azsdfepgb`
  //     const expectedResponse = { code: 450, message: 'no!' }
  //     nock(discordAPIConstants.apiHost)
  //       .get(`/channels/${channelID}`)
  //       .reply(expectedResponse.code, expectedResponse)

  //     agent
  //       .get(`/api/guilds/${guildID}/channels/${channelID}`)
  //       .expect(expectedResponse.code, { ...expectedResponse, discord: true }, done)
  //   })
  // })

  // afterAll(function () {
  //   return models.GuildRss().deleteOne({ id: guildID })
  // })
})
