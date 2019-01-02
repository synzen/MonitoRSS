/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.EXPERIMENTAL_FEATURES = 'true'

const request = require('supertest')
const app = require('../index.js')
const config = require('../../config.js')
const models = require('../../util/storage.js').models
const nock = require('nock')
const discordAPIConstants = require('../constants/discordAPI.js')
const agent = request.agent(app())

config.feeds.max = 1000

describe('/guilds/:guildId/channels', function () {
  const guildId = 'gdzsgiojij'
  const userId = 'hollabackgirl'
  beforeAll(async function (done) {
    agent
      .post('/session')
      .send({
        auth: { access_token: 'humpdy dumpdy' },
        identity: { id: userId }
      })
      .expect(200, done)
  })

  describe('GET /:channelId', function () {
    const discordAPIRoutes = [
      { route: `/guilds/${guildId}`, response: { owner_id: userId } },
      { route: `/guilds/${guildId}/roles`, response: [] },
      { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [] } }
    ]
    beforeEach(function () {
      discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
      return models.GuildRss().deleteOne({ id: guildId })
    })
    it('gives back the channel response from discord', function (done) {
      const channelId = `azsdfepgjmkgsdxcfgb`
      const discordResponse = { elon: 'is', the: 'future?', guild_id: guildId }
      nock(discordAPIConstants.apiHost)
        .get(`/channels/${channelId}`)
        .reply(200, discordResponse)

      agent
        .get(`/api/guilds/${guildId}/channels/${channelId}`)
        .expect(200, discordResponse, done)
    })
    it('returns a 403 code for a channel not in guild', function (done) {
      const channelId = `azsdfepgb`
      const discordResponse = { elon: 'is', the: 'future?', guild_id: guildId + 1 }
      const expectedResponse = { code: 403, message: { channel: 'Not part of guild' } }
      nock(discordAPIConstants.apiHost)
        .get(`/channels/${channelId}`)
        .reply(200, discordResponse)

      agent
        .get(`/api/guilds/${guildId}/channels/${channelId}`)
        .expect(expectedResponse.code, expectedResponse, done)
    })
    it(`returns discord's status code and message for channel not in guild`, function (done) {
      const channelId = `azsdfepgb`
      const expectedResponse = { code: 450, message: 'no!' }
      nock(discordAPIConstants.apiHost)
        .get(`/channels/${channelId}`)
        .reply(expectedResponse.code, expectedResponse)

      agent
        .get(`/api/guilds/${guildId}/channels/${channelId}`)
        .expect(expectedResponse.code, { ...expectedResponse, discord: true }, done)
    })
  })

  afterAll(function () {
    return models.GuildRss().deleteOne({ id: guildId })
  })
})
