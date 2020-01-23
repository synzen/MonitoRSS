const Translator = require('../../../structs/Translator.js')

function localeExists (val) {
  return Translator.hasLocale(val)
}

module.exports = localeExists
