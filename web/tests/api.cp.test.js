/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

// const request = require('supertest')
// const app = require('../index.js')
// const config = require('../../config.js')
// const agent = request.agent(app())
const httpMocks = require('node-mocks-http')
const dbOps = require('../../util/dbOps.js')
const redisOps = require('../../util/redisOps.js')
const config = require('../../config.js')
const serverLimit = require('../../util/serverLimit.js')
const fetchUser = require('../util/fetchUser.js')
const cpRoute = require('../routes/api/cp.js')
const ADMINISTRATOR_PERMISSION = 8
const MANAGE_CHANNEL_PERMISSION = 16
// config.feeds.max = 1000

jest.mock('../../util/dbOps.js')
jest.mock('../../util/redisOps.js')
jest.mock('../../util/serverLimit.js')
jest.mock('../util/fetchUser.js')

describe('/api/cp', function () {
  const userId = '62368028891823362391'
  describe('GET /', function () {
    const session = {
      identity: {
        id: userId
      },
      auth: {
        access_token: '34f9'
      }
    }
    const csrfToken = 's435o9mrf23'
    const user = { id: 'azsfde', username: 'sapodxnhm sdlrmjgt' }
    const bot = { id: 'dsknm bgvlkrjhtg', username: 'slerkhntygruihgnbjnbn' }
    const apiGuilds = [
      { id: '1', name: 'guild1', permissions: 0 }, // This should not be returned
      { id: '2', name: 'guild2', permissions: ADMINISTRATOR_PERMISSION }, // This should be returned
      { id: '3', name: 'guild3', permissions: MANAGE_CHANNEL_PERMISSION }, // This should be returned
      { id: '4', name: 'guild4', permissions: 0, owner: true }, // This should be returned
      { id: '5', name: 'guild5', permissions: 0 } // This should not be returned
    ]
    const guildCacheResults = [
      null,
      true,
      true,
      true,
      true
    ]
    const guildRsses = [
      { id: '2', anotherKey: 'foobar2', sources: { rssId1: { link: 'link1' } } },
      { id: '3', anotherAnotherKey: 'foobar3', sources: { rssId2: { link: 'link2' } } },
      { id: '4', aaa: 'fff', sources: { rssId3: { link: 'link3' }, rssId4: { link: 'link4' } } }
    ]
    const roleIdsOfGuilds = {
      '2': ['1r', '2r'],
      '3': [],
      '4': ['8r', '9r']
    }
    const roleObjectsOfIds = {
      '1r': { id: '1r', hexColor: '#000000', position: '1' },
      '2r': { id: '2r', hexColor: '#ABCD0', position: '3' },
      '8r': { id: '8r', hexColor: '#DEAF0', position: '3' },
      '9r': { id: '9r', hexColor: '#000000', position: '2' }
    }

    const channelIdsOfGuilds = {
      '2': ['1c'],
      '3': ['2c', '3c'],
      '4': ['4c']
    }
    const channelNamesOfIds = {
      '1c': 'channel1',
      '2c': 'channel2',
      '3c': 'channel3',
      '4c': 'channel4'
    }

    const serverLimits = {
      '2': 100,
      '3': 34,
      '4': 0
    }

    const failedLinkResults = [
      { link: guildRsses[0].sources.rssId1.link, count: 69 },
      { link: guildRsses[1].sources.rssId2.link, failed: 'failed date here' },
      null,
      { link: guildRsses[2].sources.rssId4.link, count: 99 }
    ]

    const generateRolesFunc = guildId => {
      return roleIdsOfGuilds[guildId].map(roleId => {
        const role = roleObjectsOfIds[roleId]
        role.position = +role.position
        if (role.hexColor === '#000000') role.hexColor = ''
        return role
      }).sort((a, b) => b.position - a.position)
    }

    const expectedResult = {
      defaultConfig: config.feeds,
      user,
      bot,
      csrfToken,
      guilds: {
        '2': {
          discord: apiGuilds[1],
          profile: guildRsses[0],
          maxFeeds: serverLimits['2'],
          roles: generateRolesFunc('2'),
          channels: channelIdsOfGuilds['2'].map(channelId => ({ id: channelId, name: channelNamesOfIds[channelId] }))
        },
        '3': {
          discord: apiGuilds[2],
          profile: guildRsses[1],
          maxFeeds: serverLimits['3'],
          roles: generateRolesFunc('3'),
          channels: channelIdsOfGuilds['3'].map(channelId => ({ id: channelId, name: channelNamesOfIds[channelId] }))
        },
        '4': {
          discord: apiGuilds[3],
          profile: guildRsses[2],
          maxFeeds: serverLimits['4'],
          roles: generateRolesFunc('4'),
          channels: channelIdsOfGuilds['4'].map(channelId => ({ id: channelId, name: channelNamesOfIds[channelId] }))
        }
      },
      linksStatus: {
        [guildRsses[0].sources.rssId1.link]: failedLinkResults[0].count,
        [guildRsses[1].sources.rssId2.link]: failedLinkResults[1].failed,
        [guildRsses[2].sources.rssId4.link]: failedLinkResults[3].count
      }
    }

    // describe('middleware', function () {
    it('returns correctly', async function () {
      redisOps.users.get.mockResolvedValueOnce(bot)
      fetchUser.info.mockResolvedValueOnce(user)
      fetchUser.guilds.mockResolvedValueOnce(apiGuilds)
      for (let i = 0; i < apiGuilds.length; ++i) {
        redisOps.guilds.exists.mockResolvedValueOnce(guildCacheResults[i])
      }
      dbOps.vips.getAll.mockResolvedValueOnce([])
      // guildRss and roles
      for (let i = 0; i < guildRsses.length; ++i) {
        const id = guildRsses[i].id
        // guild rss
        dbOps.guildRss.get.mockResolvedValueOnce(guildRsses[i])

        // roles
        const roleIdsOfThisGuild = roleIdsOfGuilds[id]
        redisOps.roles.getRolesOfGuild.mockResolvedValueOnce(roleIdsOfThisGuild)
        for (let j = 0; j < roleIdsOfThisGuild.length; ++j) {
          const roleId = roleIdsOfThisGuild[j]
          redisOps.roles.get.mockResolvedValueOnce(roleObjectsOfIds[roleId])
        }

        // channels
        const channelIdsOfThisGuild = channelIdsOfGuilds[id]
        redisOps.channels.getChannelsOfGuild.mockResolvedValueOnce(channelIdsOfThisGuild)
        for (let j = 0; j < channelIdsOfThisGuild.length; ++j) {
          const channelId = channelIdsOfThisGuild[j]
          redisOps.channels.getName.mockResolvedValueOnce(channelNamesOfIds[channelId])
        }

        serverLimit.mockResolvedValueOnce({ max: serverLimits[id] })
      }

      dbOps.failedLinks.getMultiple.mockResolvedValueOnce(failedLinkResults)

      const request = httpMocks.createRequest({ session, csrfToken: () => csrfToken })
      const response = httpMocks.createResponse()
      await cpRoute.routes.get(request, response, console.log)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResult)
    })
    // })
  })
})
