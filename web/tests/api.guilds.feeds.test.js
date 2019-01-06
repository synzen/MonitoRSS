/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const fs = require('fs')
const request = require('supertest')
const app = require('../index.js')
const config = require('../../config.js')
const models = require('../../util/storage.js').models
const nock = require('nock')
const discordAPIConstants = require('../constants/discordAPI.js')
const feedXML = fs.readFileSync('./tests/files/feed.xml', { encoding: 'utf8' })
const agent = request.agent(app())

describe('/guilds/:guildId/feeds', function () {
  const userId = 'georgie'
  beforeAll(async function (done) {
    agent
      .post('/session')
      .send({
        auth: { access_token: 'foobar' },
        identity: { id: userId }
      })
      .expect(200, done)
  })

  describe('POST /', function () {
    const guildId = 'guildmon'
    const discordAPIRoutes = [
      { route: `/guilds/${guildId}`, response: { owner_id: userId } },
      { route: `/guilds/${guildId}/roles`, response: [] },
      { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [] } }
    ]
    const feedHost = 'http://www.foobur.com'
    const feedRoute = '/rss'
    const feedURL = feedHost + feedRoute
    beforeEach(function () {
      discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
      return models.GuildRss().deleteOne({ id: guildId })
    })
    it('returns the added rssName, feed link and title after success', function (done) {
      const channelId = '32465768'
      nock(feedHost)
        .get(feedRoute)
        .reply(200, feedXML)
      nock(discordAPIConstants.apiHost)
        .get(`/channels/${channelId}`)
        .reply(200, { guild_id: guildId })

      agent
        .post(`/api/guilds/${guildId}/feeds`)
        .send({ channel: channelId, feed: feedURL })
        .expect(201)
        .end(async function (err, res) {
          if (err) return done(err)
          const { link, title, _rssName } = res.body
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            expect(doc.sources[_rssName]).toHaveProperty('title', title)
            expect(doc.sources[_rssName]).toHaveProperty('channel', channelId)
            expect(doc.sources[_rssName]).toHaveProperty('link', link)
            done()
          } catch (err) {
            done(err)
          }
        })
    })

    it('returns the added rssName, feed link and title after success with feed limit of 0 (unlimited)', function (done) {
      const originalMax = config.feeds.max
      config.feeds.max = 0
      const channelId = '32423597'
      nock(feedHost)
        .get(feedRoute)
        .reply(200, feedXML)
      nock(`${discordAPIConstants.apiHost}`)
        .get(`/channels/${channelId}`)
        .reply(200, { guild_id: guildId })

      agent
        .post(`/api/guilds/${guildId}/feeds`)
        .send({ channel: channelId, feed: feedURL })
        .expect(201)
        .end(async function (err, res) {
          config.feeds.max = originalMax
          if (err) return done(err)
          const { link, title, _rssName } = res.body
          try {
            const doc = await models.GuildRss().findOne({ id: guildId })
            expect(doc.sources[_rssName]).toHaveProperty('title', title)
            expect(doc.sources[_rssName]).toHaveProperty('channel', channelId)
            expect(doc.sources[_rssName]).toHaveProperty('link', link)
            done()
          } catch (err) {
            done(err)
          }
        })
    })

    it('returns a 400 code if feed already exists in the channel', async function (done) {
      const expectedResponse = { code: 400, message: 'Feed already exists for this channel' }
      const channelId = '3920481934890814'
      await models.GuildRss().updateOne({ id: guildId }, { $set: {
        sources: {
          foobar: {
            channel: channelId,
            link: feedURL
          }
        }
      } }, { upsert: true })

      agent
        .post(`/api/guilds/${guildId}/feeds`)
        .send({ channel: channelId, feed: feedURL })
        .expect(expectedResponse.code, expectedResponse, done)
    })

    it(`returns a 403 code if channel guild is not part of guild parameter`, function (done) {
      const expectedResponse = { code: 403, message: { channel: 'Not part of guild' } }
      const channelId = '32423597534'
      nock(feedHost)
        .get(feedRoute)
        .reply(200, feedXML)
      nock(discordAPIConstants.apiHost)
        .get(`/channels/${channelId}`)
        .reply(200, { guild_id: guildId + 'bad channel' })

      agent
        .post(`/api/guilds/${guildId}/feeds`)
        .send({ channel: channelId, feed: feedURL })
        .expect(expectedResponse.code, expectedResponse, done)
    })

    it(`returns the same code and message from Discord if channel is not seen by bot`, function (done) {
      const channelId = '32423535697534'
      const discordStatus = 410
      const discordMessage = 'foooaa'
      nock(feedHost)
        .get(feedRoute)
        .reply(200, feedXML)
      nock(discordAPIConstants.apiHost)
        .get(`/channels/${channelId}`)
        .reply(discordStatus, { message: discordMessage })

      agent
        .post(`/api/guilds/${guildId}/feeds`)
        .send({ channel: channelId, feed: feedURL })
        .expect(discordStatus, { code: discordStatus, message: discordMessage, discord: true }, done)
    })

    it('returns a 403 code if user will exceed feed limit', async function (done) {
      const channelId = '240134923'
      const originalMax = config.feeds.max
      config.feeds.max = -1
      const expectedResponse = { code: 403, message: `Guild feed limit reached (${config.feeds.max})` }
      await models.GuildRss().updateOne({ id: guildId }, { $set: {
        sources: {
          foobar: {
            channel: channelId,
            link: feedURL
          }
        }
      } }, { upsert: true })

      agent
        .post(`/api/guilds/${guildId}/feeds`)
        .send({ channel: channelId, feed: feedURL })
        .expect(expectedResponse.code, function (err, res) {
          expect(res.body).toEqual(expectedResponse)
          config.feeds.max = originalMax
          done(err)
        })
    })

    afterAll(function () {
      return models.GuildRss().deleteOne({ id: guildId })
    })
  })

  describe('PATCH /:feedId', function () {
    const guildId = 'jackie'
    const feedId = 'j]qiektgsgfbrjkg'
    const originalSource = { channel: 'whatever', title: 'nothodunk' }
    const modifyWith = { channel: '09386093284903285' }
    const discordAPIRoutes = [
      { route: `/guilds/${guildId}`, response: { owner_id: userId } },
      { route: `/guilds/${guildId}/roles`, response: [] },
      { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [] } }
    ]
    beforeEach(function () {
      discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
      return models.GuildRss().deleteOne({ id: guildId })
    })
    it(`returns a 404 when the guild doesn't exist`, async function (done) {
      await models.GuildRss().deleteOne({ id: guildId })
      agent
        .patch(`/api/guilds/${guildId}/feeds/123`)
        .expect(404, function (err, res) {
          if (err) return done(err)
          expect(res.body).toHaveProperty('message', 'Unknown Guild Profile')
          done()
        })
    })
    it(`returns a 404 when guild sources is undefined`, async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: { id: guildId } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/123`)
        .expect(404, function (err, res) {
          if (err) return done(err)
          expect(res.body).toHaveProperty('message', 'Unknown Feed')
          done()
        })
    })
    it(`returns a 404 when guild sources is an empty object`, async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {} } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/123`)
        .expect(404, function (err, res) {
          if (err) return done(err)
          expect(res.body).toHaveProperty('message', 'Unknown Feed')
          done()
        })
    })
    it('modifies and returns the guild profile after title edit', async function (done) {
      const feedId = 'j]qiektgonjhotgkishndfg'
      const originalSource = { channel: 'whatever', title: 'nothodunk' }
      const modifyWith = { title: 'hodunk' }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: originalSource
      } } }, { upsert: true })

      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}`)
        .send(modifyWith)
        .expect(200)
        .end(async function (err, res) {
          if (err) return done(err)
          expect(res.body.sources[feedId]).toEqual({ ...originalSource, ...modifyWith })
          try {
            const found = await models.GuildRss().findOne({ id: guildId })
            if (!found) return done(new Error('Document no longer exists'))
            expect(found.sources[feedId]).toEqual({ ...originalSource, ...modifyWith })
            done()
          } catch (err) {
            done(err)
          }
        })
    })
    it('returns a 400 code on modifying disallowed keys', async function (done) {
      const modifyWith = { some: 'hodunk', invalid: 'adeg', keys: 'hasud' }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: originalSource
      } } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}`)
        .send(modifyWith)
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err)
          for (const keyName in modifyWith) expect(res.body.message).toHaveProperty(keyName)
          done()
        })
    })
    it('returns a 400 code on setting a channel not part of guild', async function (done) {
      const expectedResponse = { code: 400, message: { channel: 'Not part of guild' } }
      nock(discordAPIConstants.apiHost)
        .get(`/channels/${modifyWith.channel}`)
        .reply(200, { guild_id: guildId + 1 })
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: originalSource
      } } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}`)
        .send(modifyWith)
        .expect(expectedResponse.code, expectedResponse, done)
    })
    it('modifies and returns the guild profile after valid channel edit', async function (done) {
      nock(discordAPIConstants.apiHost)
        .get(`/channels/${modifyWith.channel}`)
        .reply(200, { guild_id: guildId })
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: originalSource
      } } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}`)
        .send(modifyWith)
        .expect(200)
        .end(async function (err, res) {
          if (err) return done(err)
          expect(res.body.sources[feedId]).toEqual({ ...originalSource, ...modifyWith })
          try {
            const found = await models.GuildRss().findOne({ id: guildId })
            if (!found) return done(new Error('Document no longer exists'))
            expect(found.sources[feedId]).toEqual({ ...originalSource, ...modifyWith })
            done()
          } catch (err) {
            done(err)
          }
        })
    })
    it('returns a 400 code on empty title and/or channel', async function (done) {
      const expectedResponse = { code: 400, message: { title: 'Must not be empty', channel: 'Must not be empty' } }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: originalSource
      } } }, { upsert: true })
      agent
        .patch(`/api/guilds/${guildId}/feeds/${feedId}`)
        .send({ title: '', channel: '' })
        .expect(expectedResponse.code, expectedResponse, done)
    })
    afterAll(function () {
      return models.GuildRss().deleteOne({ id: guildId })
    })
  })

  describe('DELETE /:feedId', function () {
    const guildId = 'quashion'
    const feedId = '34fm90wm2D10WBGH4'
    const discordAPIRoutes = [
      { route: `/guilds/${guildId}`, response: { owner_id: userId } },
      { route: `/guilds/${guildId}/roles`, response: [] },
      { route: `/guilds/${guildId}/members/${userId}`, response: { roles: [] } }
    ]
    beforeEach(async function () {
      discordAPIRoutes.forEach(route => nock(discordAPIConstants.apiHost).get(route.route).reply(200, route.response))
      return models.GuildRss().deleteOne({ id: guildId })
    })
    it('removes only the feed', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: { title: 'szedglkj', channel: '235t4w9etgi' },
        someotherfeed: { title: 'sDgfjf', channel: '94032wutwg' }
      } } }, { upsert: true })
      agent
        .delete(`/api/guilds/${guildId}/feeds/${feedId}`)
        .expect(204)
        .end(async function (err, res) {
          if (err) return done(err)
          try {
            const found = await models.GuildRss().findOne({ id: guildId })
            if (!found) return done(new Error('Document no longer exists'))
            expect(found.sources[feedId]).toBeUndefined()
            done()
          } catch (err) {
            done(err)
          }
        })
    })
    it('removes the feed and guild if its the only feed remaining', async function (done) {
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {
        [feedId]: { title: 'szedglkj', channel: '235t4w9etgi' }
      } } }, { upsert: true })
      agent
        .delete(`/api/guilds/${guildId}/feeds/${feedId}`)
        .expect(204)
        .end(async function (err, res) {
          if (err) return done(err)
          try {
            expect(await models.GuildRss().findOne({ id: guildId })).toBeNull()
            done()
          } catch (err) {
            done(err)
          }
        })
    })
    it(`returns a 404 when the guild doesn't exist`, async function (done) {
      await models.GuildRss().deleteOne({ id: guildId })
      agent
        .delete(`/api/guilds/${guildId}/feeds/123`)
        .expect(404, async function (err, res) {
          if (err) return done(err)
          expect(res.body).toHaveProperty('message', 'Unknown Guild Profile')
          done()
        })
    })
    it(`returns a 404 when guild sources is undefined`, async function (done) {
      const expectedResponse = { code: 404, message: 'Unknown Feed' }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { id: guildId } }, { upsert: true })
      agent
        .delete(`/api/guilds/${guildId}/feeds/123`)
        .expect(expectedResponse.code, expectedResponse, done)
    })
    it(`returns a 404 when guild sources is an empty object`, async function (done) {
      const expectedResponse = { code: 404, message: 'Unknown Feed' }
      await models.GuildRss().updateOne({ id: guildId }, { $set: { sources: {} } }, { upsert: true })
      agent
        .delete(`/api/guilds/${guildId}/feeds/123`)
        .expect(expectedResponse.code, expectedResponse, done)
    })
    afterAll(function () {
      return models.GuildRss().deleteOne({ id: guildId })
    })
  })
})
