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

describe('/api', function () {
  const userId = '53377393422652091224'
  const accessToken = '95740162964886851841'
  beforeAll(async function (done) {
    agent
      .post('/session')
      .send({
        auth: { access_token: accessToken },
        identity: { id: userId }
      })
      .expect(200, done)
  })

  describe('/users', function () {
    describe('GET /@me', function () {
      const user = {
        username: 'username',
        locale: 'en-US',
        mfa_enabled: true,
        flags: 0,
        avatar: '4a4',
        discriminator: '2222',
        id: userId
      }
      beforeAll(function () {
        nock(discordAPIConstants.apiHost)
          .get(`/users/@me`)
          .reply(200, user)
      })
      it('return the user', function (done) {
        agent
          .get('/api/users/@me')
          .expect(200, user, done)
      })
    })
    describe('GET /@me/guilds', function () {
      const dbGuilds = ['abc', 'def', 'ghi']
      const discordAPIGuilds = [{ id: 'def' }, { id: 'ghi' }, { id: 'jkl' }]
      const expectedResponse = [{ id: 'def' }, { id: 'ghi' }]
      const guildRss = id => { return { id } }
      beforeAll(async function () {
        nock(discordAPIConstants.apiHost)
          .get(`/users/@me/guilds`)
          .reply(200, discordAPIGuilds)

        return Promise.all(dbGuilds.map(id => models.GuildRss().updateOne({ id }, { $set: { id } }, { upsert: true })))
      })
      it(`should return the user's guilds`, async function (done) {
        agent
          .get('/api/users/@me/guilds')
          .expect(200, expectedResponse, done)
      })
      afterAll(function () {
        return Promise.all(dbGuilds.map(id => models.GuildRss().deleteOne(guildRss(id))))
      })
    })
  })
})
