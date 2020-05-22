const Joi = require('@hapi/joi')
const iconv = require('iconv-lite')

const custom = Joi.extend(joi => {
  return {
    base: joi.object().pattern(/^/, joi.string()).default({}),
    type: 'config',
    messages: {
      encoding: '{{#label}} has items with invalid encodings: {{#invalid}}'
    },
    rules: {
      encoding: {
        validate (value, helpers, args, options) {
          const invalids = new Set()
          for (const url in value) {
            const encoding = value[url]
            if (!iconv.encodingExists(encoding)) {
              invalids.add(encoding)
            }
          }
          if (invalids.size > 0) {
            return helpers.error('encoding', {
              invalid: Array.from(invalids).join(',')
            })
          }
          return value
        }
      }
    }
  }
})

module.exports = custom
