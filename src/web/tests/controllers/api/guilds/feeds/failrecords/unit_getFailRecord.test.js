const getFailRecord = require('../../../../../../controllers/api/guilds/feeds/failrecords/getFailRecord.js')
const feedServices = require('../../../../../../services/feed.js')
const {
  createResponse,
  createNext
} = require('../../../../../mocks/express.js')

jest.mock('../../../../../../services/feed.js')

describe('Unit::controllers/api/guilds/feeds/failrecords/getFailRecord', function () {
  beforeEach(function () {
    feedServices.getFailRecord.mockReset()
  })
  it('returns the record', async function () {
    const record = 'w234et6yr5ahutj'
    const req = {
      feed: {
        url: 'qaew3st46ry'
      }
    }
    const res = createResponse()
    const next = createNext()
    feedServices.getFailRecord.mockResolvedValue(record)
    await getFailRecord(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(record)
  })
  it('calls the service with the right arg', async function () {
    const record = 'w234et6yr5ahutj'
    const req = {
      feed: {
        url: 'qaew3st46ry'
      }
    }
    const res = createResponse()
    const next = createNext()
    feedServices.getFailRecord.mockResolvedValue(record)
    await getFailRecord(req, res, next)
    expect(feedServices.getFailRecord)
      .toHaveBeenCalledWith(req.feed.url)
  })
})
