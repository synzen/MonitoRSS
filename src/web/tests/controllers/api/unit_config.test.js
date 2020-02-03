const config = require('../../../../config.js')
const configController = require('../../../controllers/api/config.js')
const {
  createRequest,
  createResponse
} = require('../../mocks/express.js')

describe('Unit::controllers/api/config', function () {
  it('returns the feed config', function () {
    const ovalue = config.feeds
    config.feeds = '3w2e4t6ry5tuj'
    const req = createRequest()
    const res = createResponse()
    configController(req, res)
    expect(res.json).toHaveBeenCalledWith(config.feeds)
    config.feeds = ovalue
  })
})
