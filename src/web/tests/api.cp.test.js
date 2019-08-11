/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

// const request = require('supertest')
// const app = require('../index.js')
// const config = require('../../config.js')
// const agent = request.agent(app())
const httpMocks = require('node-mocks-http')
const dbOpsVips = require('../../util/db/vips.js')
const dbOpsGuilds = require('../../util/db/guilds.js')
const dbOpsSchedules = require('../../util/db/schedules.js')
const dbOpsFailedLinks = require('../../util/db/failedLinks.js')
const RedisUser = require('../../structs/db/Redis/User.js')
const RedisGuild = require('../../structs/db/Redis/Guild.js')
const RedisRole = require('../../structs/db/Redis/Role.js')
const RedisChannel = require('../../structs/db/Redis/Channel.js')
const config = require('../../config.js')
const serverLimit = require('../../util/serverLimit.js')
const fetchUser = require('../util/fetchUser.js')
const cpRoute = require('../routes/api/cp.js')
const ADMINISTRATOR_PERMISSION = 8
const MANAGE_CHANNEL_PERMISSION = 16
// config.feeds.max = 1000

jest.mock('../../util/db/vips.js')
jest.mock('../../util/db/guilds.js')
jest.mock('../../util/db/failedLinks.js')
jest.mock('../../util/db/schedules.js')

jest.mock('../../structs/db/Redis/User.js')
jest.mock('../../structs/db/Redis/Guild.js')
jest.mock('../../structs/db/Redis/Role.js')
jest.mock('../../structs/db/Redis/Channel.js')

// jest.mock('../../util/dbOps.js')
// jest.mock('../../util/redisOps.js')
jest.mock('../../util/serverLimit.js')
jest.mock('../util/fetchUser.js')

describe('/api/cp', function () {
  const userID = '62368028891823362391'
  config.bot.ownerIDs = [userID]
  describe('GET /', function () {
    const session = {
      identity: {
        id: userID
      },
      auth: {
        access_token: '34f9'
      }
    }
    const csrfToken = 's435o9mrf23'
    const user = { id: 'azsfde', username: 'sapodxnhm sdlrmjgt' }
    const bot = { id: 'dsknm bgvlkrjhtg', username: 'slerkhntygruihgnbjnbn' }
    const botJSON = { ...bot }
    bot.toJSON = () => botJSON
    const apiGuilds = [
      { id: '1', name: 'guild1', permissions: 0 }, // This should not be returned
      { id: '2', name: 'guild2', permissions: ADMINISTRATOR_PERMISSION }, // This should be returned
      { id: '3', name: 'guild3', permissions: MANAGE_CHANNEL_PERMISSION }, // This should be returned
      { id: '4', name: 'guild4', permissions: 0, owner: true }, // This should be returned
      { id: '5', name: 'guild5', permissions: 0 } // This should not be returned
    ]
    const roleIDsOfGuilds = {
      '2': ['1r', '2r'],
      '3': [],
      '4': ['8r', '9r']
    }
    const channelIDsOfGuilds = {
      '2': ['1c'],
      '3': ['2c', '3c'],
      '4': ['4c']
    }
    const shardIDs = {
      '2': '100',
      '3': '235',
      '4': '7534'
    }
    const guildCacheResults = [
      null,
      { id: '1' },
      { id: '2', roles: roleIDsOfGuilds['2'], channels: channelIDsOfGuilds['2'], shard: shardIDs['2'] },
      { id: '3', roles: roleIDsOfGuilds['3'], channels: channelIDsOfGuilds['3'], shard: shardIDs['3'] },
      { id: '4', roles: roleIDsOfGuilds['4'], channels: channelIDsOfGuilds['4'], shard: shardIDs['4'] }
    ]
    const guildRsses = [
      { id: '2', anotherKey: 'foobar2', sources: { rssID1: { link: 'link1' } } },
      { id: '3', anotherAnotherKey: 'foobar3', sources: { rssID2: { link: 'link2' } } },
      { id: '4', aaa: 'fff', sources: { rssID3: { link: 'link3' }, rssID4: { link: 'link4' } } }
    ]

    const roleObjectsOfIDs = {
      '1r': { id: '1r', hexColor: '#000000', position: 1 },
      '2r': { id: '2r', hexColor: '#ABCD0', position: 3 },
      '8r': { id: '8r', hexColor: '#DEAF0', position: 3 },
      '9r': { id: '9r', hexColor: '#000000', position: 2 }
    }

    const roleObjectsOfIDsJSON = JSON.parse(JSON.stringify(roleObjectsOfIDs))

    for (const roleID in roleObjectsOfIDs) {
      roleObjectsOfIDs[roleID].toJSON = () => roleObjectsOfIDsJSON[roleID]
    }

    const channelObjectsOfIDs = {
      '1c': { name: 'channel1', guildID: '2' },
      '2c': { name: 'channel2', guildID: '3' },
      '3c': { name: 'channel3', guildID: '3' },
      '4c': { name: 'channel4', guildID: '4' }
    }

    const channelObjectsOfIDsJSON = JSON.parse(JSON.stringify(channelObjectsOfIDs))

    for (const channelID in channelObjectsOfIDs) {
      channelObjectsOfIDs[channelID].toJSON = () => channelObjectsOfIDsJSON[channelID]
    } 

    const serverLimits = {
      '2': 100,
      '3': 34,
      '4': 0
    }

    const failedLinkResults = [
      { link: guildRsses[0].sources.rssID1.link, count: 69 },
      { link: guildRsses[1].sources.rssID2.link, failed: 'failed date here' },
      null,
      { link: guildRsses[2].sources.rssID4.link, count: 99 }
    ]

    const schedules = [
      { name: 'fooa', refreshRateMinutes: 123 },
      { name: 'dunka', refreshRateMinutes: 543 }
    ]
    const assignedSchedules = [
      { feedID: 'rssID1', schedule: schedules[0].name },
      { feedID: 'rssID2', schedule: schedules[1].name },
      { feedID: 'rssID3', schedule: schedules[1].name },
      { feedID: 'rssID4', schedule: schedules[0].name }
    ]
    const generateRolesFunc = guildID => {
      return roleIDsOfGuilds[guildID].map(roleID => {
        const role = roleObjectsOfIDsJSON[roleID]
        if (role.hexColor === '#000000') role.hexColor = ''
        return role
      }).sort((a, b) => b.position - a.position)
    }

    const expectedResult = {
      defaultConfig: config.feeds,
      owner: true,
      user,
      bot: botJSON,
      csrfToken,
      guilds: {
        '2': {
          shard: shardIDs['2'],
          discord: apiGuilds[1],
          profile: guildRsses[0],
          maxFeeds: serverLimits['2'],
          roles: generateRolesFunc('2'),
          channels: channelIDsOfGuilds['2'].map(channelID => channelObjectsOfIDsJSON[channelID])
        },
        '3': {
          shard: shardIDs['3'],
          discord: apiGuilds[2],
          profile: guildRsses[1],
          maxFeeds: serverLimits['3'],
          roles: generateRolesFunc('3'),
          channels: channelIDsOfGuilds['3'].map(channelID => channelObjectsOfIDsJSON[channelID])
        },
        '4': {
          shard: shardIDs['4'],
          discord: apiGuilds[3],
          profile: guildRsses[2],
          maxFeeds: serverLimits['4'],
          roles: generateRolesFunc('4'),
          channels: channelIDsOfGuilds['4'].map(channelID => channelObjectsOfIDsJSON[channelID])
        }
      },
      linksStatus: {
        [guildRsses[0].sources.rssID1.link]: failedLinkResults[0].count,
        [guildRsses[1].sources.rssID2.link]: failedLinkResults[1].failed,
        [guildRsses[2].sources.rssID4.link]: failedLinkResults[3].count
      },
      feedRefreshRates: {
        rssID1: schedules[0].refreshRateMinutes,
        rssID2: schedules[1].refreshRateMinutes,
        rssID3: schedules[1].refreshRateMinutes,
        rssID4: schedules[0].refreshRateMinutes
      }
    }

    // describe('middleware', function () {
    it('returns correctly', async function () {
      fetchUser.info.mockResolvedValueOnce(user)
      RedisUser.fetch.mockResolvedValueOnce(bot)
      fetchUser.guilds.mockResolvedValueOnce(apiGuilds)

      for (let i = 0; i < apiGuilds.length; ++i) {
        RedisGuild.fetch.mockResolvedValueOnce(guildCacheResults[i])
      }
      dbOpsVips.getAll.mockResolvedValueOnce([])
      // guildRss and roles
      for (let i = 0; i < guildRsses.length; ++i) {
        const id = guildRsses[i].id
        // guild rss
        dbOpsGuilds.get.mockResolvedValueOnce(guildRsses[i])

        // roles
        const roleIDsOfThisGuild = roleIDsOfGuilds[id]
        // redisOps.roles.getRolesOfGuild.mockResolvedValueOnce(roleIDsOfThisGuild)
        for (let j = 0; j < roleIDsOfThisGuild.length; ++j) {
          const roleID = roleIDsOfThisGuild[j]
          RedisRole.fetch.mockResolvedValueOnce(roleObjectsOfIDs[roleID])
        }

        // channels
        const channelIDsOfThisGuild = channelIDsOfGuilds[id]
        // redisOps.channels.getChannelsOfGuild.mockResolvedValueOnce(channelIDsOfThisGuild)
        for (let j = 0; j < channelIDsOfThisGuild.length; ++j) {
          const channelID = channelIDsOfThisGuild[j]
          RedisChannel.fetch.mockResolvedValueOnce(channelObjectsOfIDs[channelID])
        }

        serverLimit.mockResolvedValueOnce({ max: serverLimits[id] })
      }

      dbOpsFailedLinks.getMultiple.mockResolvedValueOnce(failedLinkResults)
      dbOpsSchedules.assignedSchedules.getManyByIDs.mockResolvedValueOnce(assignedSchedules)
      dbOpsSchedules.schedules.getAll.mockResolvedValueOnce(schedules)

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
