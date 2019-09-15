const LinkLogic = require('../../../rss/logic/LinkLogic.js')

jest.mock('moment', () => {
  const func = () => ({ subtract: jest.fn() })
  func.tz = { zone: jest.fn() }
  func.locale = jest.fn()
  func.locales = jest.fn(() => [])
  return func
})
jest.mock('moment-timezone', () => {
  const func = () => ({ subtract: jest.fn() })
  func.tz = { zone: jest.fn() }
  func.locale = jest.fn()
  func.locales = jest.fn(() => [])
  return func
})
jest.mock('../../../structs/Article.js')
jest.mock('../../../rss/db/commands.js')
jest.mock('../../../util/logger.js')
jest.mock('../../../config.js')

describe('Unit::LinkLogic', function () {
  describe('run()', function () {
    it('throws an error if no scheduleName is defined', function () {
      const logic = new LinkLogic({ config: { feeds: {} } })
      return expect(logic.run()).rejects.toEqual(expect.objectContaining({ message: expect.stringContaining('schedule') }))
    })
  })
})
