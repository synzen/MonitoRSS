process.env.TEST_ENV = true
const configController = require('../../../controllers/api/config.js')
const {
  createRequest,
  createResponse
} = require('../../mocks/express.js')

jest.mock('../../../../config.js', () => ({
  get: () => ({
    feeds: {
      abc: 123,
      foo: 'br'
    }
  })
}))

describe('Unit::controllers/api/config', function () {
  it('returns the feed config', function () {
    const req = createRequest()
    const res = createResponse()
    configController(req, res)
    expect(res.json).toHaveBeenCalledWith({
      abc: 123,
      foo: 'br'
    })
  })
})
