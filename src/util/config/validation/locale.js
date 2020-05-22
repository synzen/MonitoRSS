const fs = require('fs')
const path = require('path')
const Joi = require('@hapi/joi')
const fileList = fs.readdirSync(path.join(__dirname, '..', '..', '..', 'locales'))
const localesData = new Map()
for (const file of fileList) {
  const read = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'locales', file)))
  localesData.set(file.replace('.json', ''), read)
}

const custom = Joi.extend(joi => {
  return {
    base: joi.string().strict().default('en-US'),
    type: 'config',
    messages: {
      locale: '{{#label}} needs to be a supported locale'
    },
    rules: {
      locale: {
        validate (value, helpers, args, options) {
          if (!localesData.has(value)) {
            return helpers.error('locale')
          }
          return value
        }
      }
    }
  }
})

module.exports = custom
