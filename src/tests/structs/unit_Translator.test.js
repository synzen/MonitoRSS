const Translator = require('../../structs/Translator.js')

describe('Unit::Translator', function () {
  describe('createLocaleTranslator', function () {
    it('returns a function', function () {
      expect(typeof Translator.createLocaleTranslator('eaa')).toEqual('function')
    })
  })
})
