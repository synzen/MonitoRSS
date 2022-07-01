const Joi = require('@hapi/joi')
const moment = require('moment-timezone')

const custom = Joi.extend(joi => {
  return {
    base: joi.string().strict().default('UTC'),
    type: 'config',
    messages: {
      timezone: '{{#label}} needs to be a valid timezone'
    },
    rules: {
      timezone: {
        validate (value, helpers, args, options) {
          if (!moment.tz.zone(value)) {
            return helpers.error('timezone')
          }
          return value
        }
      }
    }
  }
})

module.exports = custom
