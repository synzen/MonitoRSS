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

describe('/guilds', function () {
  const userId = '62368028891823362391'
  const accessToken = '63792409240655279865'
  beforeAll(async function (done) {
    agent
      .post('/session')
      .send({
        auth: { access_token: accessToken },
        identity: { id: userId }
      })
      .expect(200, done)
  })
  const roleManageChannel = {
    id: '8123',
    permissions: 372628561
  }
  const roleAdministrator = {
    id: '8124',
    permissions: 372628569
  }
  const roleIdManageChannel = roleManageChannel.id
  const roleIdAdministrator = roleAdministrator.id
  const discordAPIRoutes = (guildId, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole) => [
    { route: `/guilds/${guildId}`, response: { owner_id: isOwner ? userId : userId + '123' } },
    { route: `/guilds/${guildId}/roles`, response: hasRoleInGuild ? [ roleManageChannel, roleAdministrator ] : [] },
    { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [ hasManageChannelRole ? roleIdManageChannel : hasAdministratorRole ? roleIdAdministrator : 0 ] } }
  ]
  const mockDiscordAPIRoutes = (guildId, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole) => {
    discordAPIRoutes(guildId, isOwner, hasRoleInGuild, hasManageChannelRole, hasAdministratorRole).forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
  }

  describe('GET /:guildId', function () {
    const guildId = '5292010923'
    const guildRss = { id: guildId }
    // The user must meet two conditions to have access to this guild - they are either the owner, or has a role with MANAGE_CHANNELS permission
    beforeAll(function () {
      return models.GuildRss().updateOne({ id: guildId }, { $set: guildRss }, { upsert: true })
    })

    it('returns the guild for user as owner but no roles', function (done) {
      mockDiscordAPIRoutes(guildId, true)
      agent
        .get(`/api/guilds/${guildId}`)
        .expect(200, guildRss, done)
    })

    it('returns the guild for user with Manage Channels role', function (done) {
      mockDiscordAPIRoutes(guildId, false, true, true)
      agent
        .get(`/api/guilds/${guildId}`)
        .expect(200, guildRss, done)
    })

    it('returns a guild for user with Administrator role', function (done) {
      mockDiscordAPIRoutes(guildId, false, true, false, true)
      agent
        .get(`/api/guilds/${guildId}`)
        .expect(200, guildRss, done)
    })

    it('returns a 401 code for user with no role in guild', function (done) {
      mockDiscordAPIRoutes(guildId)
      agent
        .get(`/api/guilds/${guildId}`)
        .expect(401, done)
    })

    it('returns a 401 code for user with no role in guild and also not owner', function (done) {
      mockDiscordAPIRoutes(guildId, false, false, true, true)
      agent
        .get(`/api/guilds/${guildId}`)
        .expect(401, done)
    })

    afterAll(function () {
      return models.GuildRss().deleteOne(guildRss)
    })
  })

  describe('DELETE /:guildId', function () {
    const guildId = '2974936509'
    const guildRss = { id: guildId }
    beforeEach(async function () {
      mockDiscordAPIRoutes(guildId, true) // Just let the user be owner for these tests
      return models.GuildRss().deleteOne({ id: guildId })
    })
    it('returns a 204 code on success', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: guildRss }, { upsert: true })
      agent
        .delete(`/api/guilds/${guildId}`)
        .expect(204, done)
    })
    it('returns a 404 on no guild found', async function (done) {
      await models.GuildRss().deleteOne({ id: guildId })
      agent
        .delete(`/api/guilds/${guildId}`)
        .expect(404, done)
    })
    afterAll(function () {
      return models.GuildRss().deleteOne({ id: guildId })
    })
  })

  describe('PATCH /:guildId', function () {
    const guildId = '1003077591'
    const correctlyModifyWith = {
      timezone: 'joey',
      prefix: 'asad',
      sendAlertsTo: ['123'],
      dateFormat: '243y',
      dateLanguage: 'qawsrfe'
    }
    const incorrectlyModifyWith = {
      timezone: 1,
      prefix: 1,
      sendAlertsTo: [[]],
      dateFormat: 1
    }
    beforeEach(function () {
      return models.GuildRss().deleteOne({ id: guildId })
    })
    it('returns the updated guildRss with valid keys for an existent guildRss', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: { id: guildId } }, { upsert: true })
      mockDiscordAPIRoutes(guildId, true)
      agent
        .patch(`/api/guilds/${guildId}`)
        .send(correctlyModifyWith)
        .expect(200, { id: guildId, ...correctlyModifyWith }, done)
    })

    it('returns a 201 code with the updated guildRss with valid keys for a nonexistent guildRss', async function (done) {
      await models.GuildRss().deleteOne({ id: guildId })
      mockDiscordAPIRoutes(guildId, true)
      agent
        .patch(`/api/guilds/${guildId}`)
        .send(correctlyModifyWith)
        // .expect(res => console.log(res))
        .expect(201, { id: guildId, ...correctlyModifyWith }, done)
    })

    it('returns a 400 code for using wrong types on modifications with correct details', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: { id: guildId } }, { upsert: true })
      mockDiscordAPIRoutes(guildId, true)
      agent
        .patch(`/api/guilds/${guildId}`)
        .send(incorrectlyModifyWith)
        // .expect(res => console.log(res))
        .expect(400)
        .end(function (err, res) {
          if (err) done(err)
          const body = res.body.message
          expect(body).toHaveProperty('timezone')
          expect(body).toHaveProperty('prefix')
          expect(body).toHaveProperty('sendAlertsTo')
          expect(body).toHaveProperty('dateFormat')
          expect(body).not.toHaveProperty('dateLanguage')
          done()
        })
    })
    afterAll(function () {
      return models.GuildRss().deleteOne({ id: guildId })
    })
  })
})
