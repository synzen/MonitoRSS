const fs = require('fs')
const path = require('path')
const config = require('../config.js')
const log = require('../util/logger.js')
const defaultLocale = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', config.bot.locale + '.json')))
const localesData = new Map()
const fileList = fs.readdirSync(path.join(__dirname, '..', 'locales'))
for (const file of fileList) {
  const read = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', file)))
  localesData.set(file.replace('.json', ''), read)
}

function escapeRegExp (str) {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}

class Translator {
  constructor (locale = config.bot.locale) {
    /**
     * Locale string
     * @type {string}
     */
    this.locale = locale
  }

  /**
   * Convert a string according to the translator's locale
   * @param {string} string - Accessor
   * @param {Object.<string, number|string>} params - Keys to replace in string
   */
  translate (string, params) {
    return Translator.translate(string, this.locale, params)
  }

  static createLocaleTranslator (locale) {
    return (string, params) => this.translate(string, locale, params)
  }

  /**
   * Check if a locale exists
   * @param {string} locale
   * @returns {boolean}
   */
  static hasLocale (locale) {
    return localesData.has(locale)
  }

  /**
   * Get list of defined locales
   * @returns {string[]}
   */
  static getLocales () {
    return Array.from(localesData.keys()).sort()
  }

  /**
   * Get command descriptions used for rsshelp
   * @param {string} locale
   */
  static getCommandDescriptions (locale = config.bot.locale) {
    return localesData.get(locale).commandDescriptions
  }

  /**
   * Convert a string according to the given locale
   * @param {string} string - Accessor
   * @param {string} locale - Locale
   * @param {Object.<string, number|string>} [params] - Keys to replace in the string
   * @returns {string}
   */
  static translate (string, locale = config.bot.locale, params) {
    if (typeof string !== 'string') {
      throw new TypeError('string is not a string')
    }
    if (typeof locale !== 'string') {
      throw new TypeError('locale is not a string')
    }
    if (!localesData.has(locale)) {
      throw new Error('Unknown locale: ' + locale)
    }
    const properties = string.split('.')
    let accessedSoFar = localesData.get(locale)
    let reference = defaultLocale
    for (const property of properties) {
      accessedSoFar = accessedSoFar[property]
      reference = reference[property]
      if (accessedSoFar === undefined) {
        log.general.error(`Invalid locale accessor ("${string}" stopped at "${property}") for locale ${locale}`)
        throw new Error(`Invalid locale accessor (stopped at "${property}") for locale ${locale}`)
      }
      if (!reference) {
        log.general.error(`Invalid locale accessor (no en-US locale reference of "${string}" at "${property}") for locale ${locale}`)
        throw new Error(`Invalid locale accessor (no en-US locale reference at "${property}") for locale ${locale}`)
      }
    }
    if (typeof accessedSoFar !== 'string') {
      log.general.error(`Invalid locale accessor that stopped with a non-string value ("${string}") for locale ${locale}`)
      throw new Error(`Invalid locale accessor that stopped with a non-string value for locale ${locale}`)
    }
    if (accessedSoFar.length === 0) {
      accessedSoFar = reference // Use the reference if the original locale is an empty string
    }
    if (params) {
      for (const param in params) {
        const term = escapeRegExp(`{{${param}}}`)
        const regex = new RegExp(term, 'g')
        accessedSoFar = accessedSoFar.replace(regex, params[param])
      }
    }
    return accessedSoFar
  }
}

module.exports = Translator
