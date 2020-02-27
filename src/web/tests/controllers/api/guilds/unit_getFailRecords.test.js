process.env.TEST_ENV = true
const getFailRecords = require('../../../../controllers/api/guilds/getFailRecords.js')
const feedServices = require('../../../../services/feed.js')
const {
  createResponse,
  createNext
} = require('../../../mocks/express.js')

jest.mock('../../../../services/feed.js')
jest.mock('../../../../../config.js')

describe('Unit::controllers/api/guilds/getFailRecords', function () {
  it('returns the fail records of urls', async function () {
    const req = {
      params: {}
    }
    feedServices.getFeedsOfGuild.mockResolvedValue([{
      url: 'a'
    }, {
      url: 'b'
    }])
    const records = [1, 2]
    feedServices.getFailRecord
      .mockResolvedValueOnce(records[0])
      .mockResolvedValueOnce(records[1])
    const res = createResponse()
    const next = createNext()
    await getFailRecords(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(records)
  })
  it('does not return dupe records for same urls', async function () {
    const req = {
      params: {}
    }
    feedServices.getFeedsOfGuild.mockResolvedValue([{
      url: 'a'
    }, {
      url: 'a'
    }])
    feedServices.getFailRecord
      .mockResolvedValue(1)
    const res = createResponse()
    const next = createNext()
    await getFailRecords(req, res, next)
    expect(res.json).toHaveBeenCalledWith([1])
  })
  it('calls the service with the right args', async function () {
    const req = {
      params: {
        guildID: 123
      }
    }
    feedServices.getFeedsOfGuild.mockResolvedValue([{
      url: 'a'
    }, {
      url: 'b'
    }])
    feedServices.getFailRecord
      .mockResolvedValue(1)
    const res = createResponse()
    const next = createNext()
    await getFailRecords(req, res, next)
    expect(feedServices.getFeedsOfGuild)
      .toHaveBeenCalledWith(req.params.guildID)
    expect(feedServices.getFailRecord)
      .toHaveBeenCalledWith('a')
    expect(feedServices.getFailRecord)
      .toHaveBeenCalledWith('b')
  })
  it('calls next if get feed service fails', async function () {
    const req = {
      params: {}
    }
    const error = new Error('aqewtgsdr')
    feedServices.getFeedsOfGuild.mockRejectedValue(error)
    const res = createResponse()
    const next = createNext()
    await getFailRecords(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('calls the service if get fail record service fails', async function () {
    const req = {
      params: {
        guildID: 123
      }
    }
    const error = new Error('wseryhgfd')
    feedServices.getFeedsOfGuild.mockResolvedValue([{
      url: 'a'
    }, {
      url: 'b'
    }])
    feedServices.getFailRecord.mockRejectedValue(error)
    const res = createResponse()
    const next = createNext()
    await getFailRecords(req, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })
  it('filters out null records', async function () {
    const req = {
      params: {}
    }
    feedServices.getFeedsOfGuild.mockResolvedValue([{
      url: 'a'
    }, {
      url: 'b'
    }])
    feedServices.getFailRecord
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(null)
    const res = createResponse()
    const next = createNext()
    await getFailRecords(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json.mock.calls[0][0]).toHaveLength(1)
    expect(res.json.mock.calls[0][0]).not.toContain(null)
    expect(res.json).toHaveBeenCalledWith([1])
  })
})
