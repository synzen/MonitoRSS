const Joi = require('@hapi/joi')

module.exports = Joi.extend(joi => {
  return {
    base: joi.string().allow('').trim().optional(),
    type: 'embed',
    messages: {
      timestamp: 'needs to be "now" or "article"'
    },
    rules: {
      isTimestamp: {
        validate (value, helpers, args, options) {
          if (value !== 'now' && value !== 'article') {
            return helpers.error('timestamp')
          }
          return value
        }
      }
    }
  }
})
