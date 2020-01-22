const validators = require('../../util/validators/index.js')
const moment = require('moment-timezone')

jest.mock('moment-timezone')

describe('Unit::util/validators', function () {
  describe('isValidTimestamp', function () {
    it('returns correctly', function () {
      const r1 = validators.isValidTimestamp('article')
      const r2 = validators.isValidTimestamp('now')
      const r3 = validators.isValidTimestamp('sadf')
      expect(r1).toEqual(true)
      expect(r2).toEqual(true)
      expect(r3).toEqual(false)
    })
  })
  describe('isTimezone', function () {
    afterEach(function () {
      moment.tz.zone.mockReset()
    })
    it('returns correctly', function () {
      moment.tz.zone.mockReturnValue(true)
      expect(validators.isTimezone()).toEqual(true)
      moment.tz.zone.mockReturnValue(false)
      expect(validators.isTimezone()).toEqual(false)
    })
  })
})
