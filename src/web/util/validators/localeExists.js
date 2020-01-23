const Translator = require('../../../structs/Translator.js')

function localeExists (val) {
  if (val === '') {
    return true
  }
  return Translator.hasLocale(val)
}

module.exports = localeExists
