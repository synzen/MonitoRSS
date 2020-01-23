const moment = require('moment-timezone')
const validators = require('../../util/validators/index.js')
const Translator = require('../../../structs/Translator.js')
const config = require('../../../config.js')
const mongoose = require('mongoose')

jest.mock('../../../config.js')
jest.mock('mongoose')

describe('Unit::util/validators', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('isValidTimestamp', function () {
    it('returns correctly', function () {
      const r1 = validators.isValidTimestamp('article')
      const r2 = validators.isValidTimestamp('now')
      const r3 = validators.isValidTimestamp('sadf')
      expect(r1).toEqual(true)
      expect(r2).toEqual(true)
      expect(r3).toEqual(false)
    })
    it('returns true for empty string', function () {
      expect(validators.isValidTimestamp('')).toEqual(true)
    })
  })
  describe('isTimezone', function () {
    it('returns correctly', function () {
      const oVal = moment.tz.zone
      moment.tz.zone = jest.fn().mockReturnValue(true)
      expect(validators.isTimezone()).toEqual(true)
      moment.tz.zone.mockReturnValue(false)
      expect(validators.isTimezone()).toEqual(false)
      moment.tz.zone = oVal
    })
    it('returns true for empty string', function () {
      expect(validators.isTimezone('')).toEqual(true)
    })
  })
  describe('localeExists', function () {
    it('returns correctly', function () {
      jest.spyOn(Translator, 'hasLocale').mockReturnValue(true)
      expect(validators.localeExists(3)).toEqual(true)
      jest.spyOn(Translator, 'hasLocale').mockReturnValue(false)
      expect(validators.localeExists(3)).toEqual(false)
    })
    it('returns true for empty string', function () {
      expect(validators.localeExists('')).toEqual(true)
    })
  })
  describe('dateLanguageExists', function () {
    it('returns correctly', function () {
      const oval = config.feeds.dateLanguageList
      config.feeds.dateLanguageList = [1, 2]
      expect(validators.dateLanguageExists(2)).toEqual(true)
      expect(validators.dateLanguageExists(3)).toEqual(false)
      config.feeds.dateLanguageList = oval
    })
    it('returns true for empty string', function () {
      expect(validators.dateLanguageExists('')).toEqual(true)
    })
  })
  describe('isMongoID', function () {
    afterEach(function () {
      mongoose.Types.ObjectId.isValid.mockReset()
    })
    mongoose.Types.ObjectId.isValid.mockReturnValue(true)
    expect(validators.isMongoID('as')).toEqual(true)
    mongoose.Types.ObjectId.isValid.mockReturnValue(false)
    expect(validators.isMongoID('as')).toEqual(false)
  })
})
