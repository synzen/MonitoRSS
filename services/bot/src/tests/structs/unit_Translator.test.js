process.env.TEST_ENV = true
const Translator = require('../../structs/Translator.js')

jest.mock('../../config.js')

describe('Unit::Translator', function () {
  afterEach(function () {
    jest.restoreAllMocks()
  })
  describe('createLocaleTranslator', function () {
    it('returns a function', function () {
      expect(typeof Translator.createLocaleTranslator('eaa')).toEqual('function')
    })
  })
  describe('createProfileTranslator', function () {
    it('creates a locale translator correctly', function () {
      const createLocaleTranslator = jest.spyOn(Translator, 'createLocaleTranslator')
        .mockImplementation()
      Translator.createProfileTranslator()
      expect(createLocaleTranslator).toHaveBeenCalledWith(undefined)
      createLocaleTranslator.mockReset()
      Translator.createProfileTranslator({
        locale: 'qwerty'
      })
      expect(createLocaleTranslator).toHaveBeenCalledWith('qwerty')
    })
  })
  describe('hasLocale', function () {
    it('returns whether this.LOCALES_DATA has a locale', function () {
      const addLocale = 'awsofikerhsduighnbdefhnguerdoiedh'
      Translator.LOCALES_DATA.set(addLocale, {})
      expect(Translator.hasLocale(addLocale)).toEqual(true)
      Translator.LOCALES_DATA.delete(addLocale)
      expect(Translator.hasLocale(addLocale)).toEqual(false)
    })
  })
  describe('getLocales', function () {
    const originalValue = Array.from(Translator.LOCALES_DATA)
    const mockValues = [['z', 2], ['c', 1], ['b', 2], ['a', 3]]

    beforeEach(function () {
      Translator.LOCALES_DATA.clear()
      for (let i = 0; i < mockValues.length; ++i) {
        Translator.LOCALES_DATA.set(mockValues[i][0], mockValues[i][1])
      }
    })
    afterEach(function () {
      Translator.LOCALES_DATA.clear()
      for (let i = 0; i < originalValue.length; ++i) {
        Translator.LOCALES_DATA.set(originalValue[i][0], originalValue[i][1])
      }
    })
    it('returns the Map of locales as a sorted array', function () {
      expect(Translator.getLocales()).toBeInstanceOf(Array)
    })
    it('returns the array of locales as sorted', function () {
      expect(Translator.getLocales()).toEqual(['a', 'b', 'c', 'z'])
    })
  })
  describe('getCommandDescriptions', function () {
    it('returns the .commandDescriptions property of a locale\'s data', function () {
      const mockLocale = 'oiwe3rjtui8w9o32p4ehygnbediruhy8345'
      const mockLocaleData = { commandDescriptions: 'abc123' }
      Translator.LOCALES_DATA.set(mockLocale, mockLocaleData)
      expect(Translator.getCommandDescriptions(mockLocale)).toEqual(mockLocaleData.commandDescriptions)
      Translator.LOCALES_DATA.delete(mockLocale)
    })
  })
  describe('translate', function () {
    const testLocale = 'asfwsgikj'
    const testLocaleData = { a: { b: { c: 1 }, arrayKey: [], numberKey: 1 } }
    beforeAll(function () {
      expect(Translator.LOCALES_DATA.has(testLocale)).toEqual(false)
      Translator.LOCALES_DATA.set(testLocale, testLocaleData)
    })
    afterAll(function () {
      Translator.LOCALES_DATA.delete(testLocale)
    })
    it.todo('throws an error if translate string is not a string')
    it.todo('throws an error if locale is not a string')
    it.todo('throws an error if the locale is unknown')
    it.todo('throws an error if the specified locale is undefined at some point')
    it.todo('throws an error if the specified locale is not a string')
    it.todo('throws an error if the specified locale is an empty string but the reference locale does not exist')
    it.todo('throws an error if the reference locale is undefined at some point')
    it.todo('gives the reference locale string if the specified locale is an empty string')
    it.todo('gives the specified locale if it exists')
  })
})
