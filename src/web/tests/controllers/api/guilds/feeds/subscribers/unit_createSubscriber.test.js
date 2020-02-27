process.env.TEST_ENV = true
const createSubscriber = require('../../../../../../controllers/api/guilds/feeds/subscribers/createSubscriber.js')
const roleServices = require('../../../../../../services/role.js')
const userServices = require('../../../../../../services/user.js')
const subscriberServices = require('../../../../../../services/subscriber.js')
const createError = require('../../../../../../util/createError.js')
const {
  createResponse,
  createNext
} = require('../../../../../mocks/express.js')

jest.mock('../../../../../../services/role.js')
jest.mock('../../../../../../services/user.js')
jest.mock('../../../../../../services/subscriber.js')
jest.mock('../../../../../../util/createError.js')
jest.mock('../../../../../../../config.js')

describe('Unit::controllers/api/guilds/feeds/subscribers/createSubscriber', function () {
  afterEach(function () {
    roleServices.isRoleOfGuild.mockReset()
    userServices.getMemberOfGuild.mockReset()
    subscriberServices.createSubscriber.mockReset()
  })
  it('returns the created subscriber for user', async function () {
    const req = {
      params: {},
      body: {
        type: 'user'
      }
    }
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const createdSubscriber = 3245634
    userServices.getMemberOfGuild.mockResolvedValue({})
    subscriberServices.createSubscriber.mockResolvedValue(createdSubscriber)
    const next = createNext()
    await createSubscriber(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
    expect(json).toHaveBeenCalledWith(createdSubscriber)
  })
  it('returns the created subscriber for role', async function () {
    const req = {
      params: {},
      body: {
        type: 'role'
      }
    }
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const createdSubscriber = 3245634
    roleServices.isRoleOfGuild.mockResolvedValue(true)
    subscriberServices.createSubscriber.mockResolvedValue(createdSubscriber)
    const next = createNext()
    await createSubscriber(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
    expect(json).toHaveBeenCalledWith(createdSubscriber)
  })
  it('calls next with error if role service fails fail', async function () {
    const req = {
      params: {},
      body: {
        type: 'role'
      }
    }
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    const error = new Error('etwsgry')
    roleServices.isRoleOfGuild.mockRejectedValue(error)
    const next = createNext()
    await createSubscriber(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls next with error if user service fails fail', async function () {
    const req = {
      params: {},
      body: {
        type: 'user'
      }
    }
    const res = createResponse()
    const error = new Error('etwsgry')
    userServices.getMemberOfGuild.mockRejectedValue(error)
    const next = createNext()
    await createSubscriber(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls next with error if subscriber service fails fail', async function () {
    const req = {
      params: {},
      body: {
        type: 'role'
      }
    }
    const res = createResponse()
    const error = new Error('etwsgry')
    roleServices.isRoleOfGuild.mockResolvedValue(true)
    subscriberServices.createSubscriber.mockRejectedValue(error)
    const next = createNext()
    await createSubscriber(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls user services with the right args', async function () {
    const req = {
      params: {
        guildID: 'w4try5',
        feedID: '32wet4ryh'
      },
      body: {
        id: '3254r',
        type: 'user',
        filters: {
          a: ['a']
        }
      }
    }
    const res = createResponse()
    userServices.getMemberOfGuild.mockResolvedValue({})
    subscriberServices.createSubscriber.mockResolvedValue()
    const next = createNext()
    await createSubscriber(req, res, next)
    expect(userServices.getMemberOfGuild)
      .toHaveBeenCalledWith(req.body.id, req.params.guildID)
  })
  it('calls role services with the right args', async function () {
    const req = {
      params: {
        guildID: 'w4try5',
        feedID: '32wet4ryh'
      },
      body: {
        id: '3254r',
        type: 'role',
        filters: {
          a: ['a']
        }
      }
    }
    const res = createResponse()
    roleServices.isRoleOfGuild.mockResolvedValue(true)
    subscriberServices.createSubscriber.mockResolvedValue()
    const next = createNext()
    await createSubscriber(req, res, next)
    expect(roleServices.isRoleOfGuild)
      .toHaveBeenCalledWith(req.body.id, req.params.guildID)
  })
  it('calls subscriber services with the right args', async function () {
    const req = {
      params: {
        guildID: 'w4try5',
        feedID: 'qw4etry'
      },
      body: {
        id: '3254r',
        type: 'role',
        filters: {
          a: ['a']
        }
      }
    }
    const res = createResponse()
    roleServices.isRoleOfGuild.mockResolvedValue(true)
    subscriberServices.createSubscriber.mockResolvedValue()
    const next = createNext()
    await createSubscriber(req, res, next)
    expect(subscriberServices.createSubscriber)
      .toHaveBeenCalledWith({
        ...req.body,
        feed: req.params.feedID
      })
    subscriberServices.createSubscriber.mockReset()
    // Make sure filters is turned into an empty object
    req.body.filters = null
    await createSubscriber(req, res, next)
    expect(subscriberServices.createSubscriber)
      .toHaveBeenCalledWith({
        ...req.body,
        filters: {},
        feed: req.params.feedID
      })
  })
  it('returns 403 when is not role of guild', async function () {
    const req = {
      params: {},
      body: {
        type: 'role'
      }
    }
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    roleServices.isRoleOfGuild.mockResolvedValue(false)
    const next = createNext()
    const createdError = 34
    createError.mockReturnValue(createdError)
    await createSubscriber(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(createdError)
  })
  it('returns 403 when is not user of guild', async function () {
    const req = {
      params: {},
      body: {
        type: 'user'
      }
    }
    const json = jest.fn()
    const res = {
      status: jest.fn(() => ({ json }))
    }
    userServices.getMemberOfGuild.mockResolvedValue(null)
    const next = createNext()
    const createdError = 34
    createError.mockReturnValue(createdError)
    await createSubscriber(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(createdError)
  })
})
