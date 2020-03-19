const Joi = require('@hapi/joi')
const moment = require('moment-timezone')
const Translator = require('../../../../structs/Translator.js')
const getConfig = require('../../../../config.js').get

module.exports = Joi.extend(joi => {
  const config = getConfig()
  return {
    base: joi.string().allow('').trim(),
    type: 'profile',
    messages: {
      timezone: 'needs to be a valid timezone',
      locale: `needs to be a supported locale (${Translator.getLocales().join(',')})`,
      dateLanguage: `needs to be a supported date language (${config.feeds.dateLanguageList.join(',')})`
    },
    rules: {
      isTimezone: {
        validate (value, helpers) {
          if (!moment.tz.zone(value)) {
            return helpers.error('timezone')
          }
          return value
        }
      },
      isLocale: {
        validate (value, helpers) {
          if (Translator.hasLocale(value)) {
            return helpers.error('locale')
          }
          return value
        }
      },
      isDateLanguage: {
        validate (value, helpers) {
          const list = config.feeds.dateLanguageList
          if (!list.includes(value)) {
            return helpers.error('dateLanguage')
          }
          return value
        }
      }
    }
  }
})
