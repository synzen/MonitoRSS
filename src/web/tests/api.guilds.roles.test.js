/* eslint-env node, jest */
process.env.NODE_ENV = 'test'
process.env.DRSS_EXPERIMENTAL_FEATURES = 'true'

const httpMocks = require('node-mocks-http')
const RedisRole = require('../../structs/db/Redis/Role.js')
const rolesRoute = require('../routes/api/guilds.roles.js')

jest.mock('../../structs/db/Redis/Role.js')

RedisRole.utils = {
  getRolesOfGuild: jest.fn(() => Promise.resolve())
}

describe('/api/guilds/:guildId/roles', function () {
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
    // Positions are auto-converted to numbers by RedisRole.fetch
    it('returns roles of a guild', async function () {
      const request = httpMocks.createRequest({ session, params })
      const response = httpMocks.createResponse()
      const roleIds = ['1', '2']
      const rolesInfo = [{ id: roleIds[0], name: 'name1', position: 4 }, { id: roleIds[1], name: 'name2', position: 1 }]
      const expectedResponse = [
        { id: roleIds[0], name: rolesInfo[0].name, position: rolesInfo[0].position },
        { id: roleIds[1], name: rolesInfo[1].name, position: rolesInfo[1].position }
      ]
      
      RedisRole.utils.getRolesOfGuild.mockResolvedValueOnce(roleIds)
      RedisRole.fetch
        .mockResolvedValueOnce({ ...rolesInfo[0], toJSON: () => rolesInfo[0] })
        .mockResolvedValueOnce({ ...rolesInfo[1], toJSON: () => rolesInfo[1] })
      await rolesRoute.routes.getRoles(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
    it('returns roles of a guild, sorted', async function () {
      const request = httpMocks.createRequest({ session, params })
      const response = httpMocks.createResponse()
      const roleIds = ['1', '2']
      const rolesInfo = [{ id: roleIds[0], name: 'name1', position: 4 }, { id: roleIds[1], name: 'name2', position: 1 }]
      const expectedResponse = [
        { id: roleIds[1], name: rolesInfo[1].name, position: rolesInfo[1].position },
        { id: roleIds[0], name: rolesInfo[0].name, position: rolesInfo[0].position }
      ]
      RedisRole.utils.getRolesOfGuild.mockResolvedValueOnce(roleIds)
      RedisRole.fetch
        .mockResolvedValueOnce({ ...rolesInfo[0], toJSON: () => rolesInfo[0] })
        .mockResolvedValueOnce({ ...rolesInfo[1], toJSON: () => rolesInfo[1] })
      await rolesRoute.routes.getRoles(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse.sort((a, b) => b.position - a.position))
    })
    it('returns roles with #000000 hexColor converted to empty strings', async function () {
      const request = httpMocks.createRequest({ session, params })
      const response = httpMocks.createResponse()
      const roleIds = ['1', '2']
      const rolesInfo = [{ id: roleIds[0], name: 'name1', position: 4, hexColor: '#000000' }, { id: roleIds[1], name: 'name2', position: 1, hexColor: '#ABC00' }]
      const expectedResponse = [
        { id: roleIds[0], name: rolesInfo[0].name, position: rolesInfo[0].position, hexColor: '' },
        { id: roleIds[1], name: rolesInfo[1].name, position: rolesInfo[1].position, hexColor: rolesInfo[1].hexColor }
      ]
      RedisRole.utils.getRolesOfGuild.mockResolvedValueOnce(roleIds)
      RedisRole.fetch
        .mockResolvedValueOnce({ ...rolesInfo[0], toJSON: () => rolesInfo[0] })
        .mockResolvedValueOnce({ ...rolesInfo[1], toJSON: () => rolesInfo[1] })
      await rolesRoute.routes.getRoles(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
    it('returns empty array if no roles are found', async function () {
      const request = httpMocks.createRequest({ session, params })
      const response = httpMocks.createResponse()
      const expectedResponse = []
      RedisRole.utils.getRolesOfGuild.mockResolvedValueOnce([])
      await rolesRoute.routes.getRoles(request, response)
      expect(response.statusCode).toEqual(200)
      const data = JSON.parse(response._getData())
      expect(data).toEqual(expectedResponse)
    })
  })
})
