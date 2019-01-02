/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.EXPERIMENTAL_FEATURES = 'true'

const request = require('supertest')
const app = require('../index.js')
const models = require('../../util/storage.js').models
const nock = require('nock')
const discordAPIConstants = require('../constants/discordAPI.js')
const agent = request.agent(app())

describe('/guilds/:guildId/feeds/:feedId/filters', function () {
  const userId = 'kramer'
  const guildId = 'guildtankSOULJABOY'
  const roles = [
    { id: 'role1', name: 'role1name' },
    { id: 'role2', name: 'role2name' },
    { id: 'role3', name: 'role3name' }]
  const discordAPIRoutes = [
    { route: `/guilds/${guildId}`, response: { owner_id: userId } },
    { route: `/guilds/${guildId}/roles`, response: roles },
    { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [] } }]
  beforeEach(async function () {
    discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
    await models.GuildRss().deleteOne({ id: guildId })
  })
  beforeAll(async function (done) {
    agent
      .post('/session')
      .send({
        auth: { access_token: 'george the yellow monkey' },
        identity: { id: userId }
      })
      .expect(200, done)
  })

  describe('DELETE /', function () {
    const feedId = 'topkek'
    it('returns a 204 code and deletes filters of a feed', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: {
        sources: {
          [feedId]: {
            filters: {
              title: 'trololo'
            }
          }
        }
      } }, { upsert: true })
      agent
        .delete(`/api/guilds/${guildId}/feeds/${feedId}/filters`)
        .expect(204)
        .end(async function (err, res) {
          if (err) return done(err)
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            if (!doc) return done(new Error('No document found'))
            expect(doc.sources[feedId].filters).toBeUndefined()
            done()
          } catch (err) {
            done(err)
          }
        })
    })
  })

  describe('PATCH /', function () {
    const feedId = 'so close to finishing'
    const modifyWith = { description: 'HOLY MOLY' }
    it('updates filters', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: {
        sources: {
          [feedId]: {
            filters: {
              title: 'trololololololo'
            }
          }
        }
      } }, { upsert: true })

      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}/filters`)
        .send({ filters: modifyWith })
        .expect(200)
        .end(async function (err, res) {
          if (err) return done(err)
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            if (!doc) return done(new Error('No document found'))
            expect(doc.sources[feedId].filters).toEqual(modifyWith)
            done()
          } catch (err) {
            done(err)
          }
        })
    })

    it('returns a 400 code for missing filters object', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: {
        sources: {
          [feedId]: {
            filters: {
              title: 'trololol'
            }
          }
        }
      } }, { upsert: true })

      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}/filters`)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message.filters).toBe('This is a required field')
          done()
        })
    })

    it('returns a 400 code for unpopulated filters object', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: {
        sources: {
          [feedId]: {
            filters: {
              title: 'trololol'
            }
          }
        }
      } }, { upsert: true })

      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}/filters`)
        .send({ filters: {} })
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message.filters).toBe('Must be a populated object')
          done()
        })
    })
  })

  afterAll(function () {
    return models.GuildRss().deleteOne({ id: guildId })
  })
})
