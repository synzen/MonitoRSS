const getSchedule = require('../../../../../controllers/api/guilds/feeds/getSchedule.js')
const {
  createResponse,
  createNext
} = require('../../../../mocks/express.js')

describe('Unit::controllers/api/guilds/feeds/getSchedule', function () {
  it('returns the determined schedule', async function () {
    const determinedSchedule = 'w234et6yr5ahutj'
    const req = {
      feed: {
        determineSchedule: jest.fn().mockResolvedValue(determinedSchedule)
      }
    }
    const res = createResponse()
    const next = createNext()
    await getSchedule(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(determinedSchedule)
  })
})
