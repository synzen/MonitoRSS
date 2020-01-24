const Joi = require('@hapi/joi')
const profileJoi = require('./custom/profile.js')

const profileSchema = Joi.object({
  dateFormat: Joi.string().trim().max(400),
  dateLanguage: profileJoi.profile().isDateLanguage(),
  timezone: profileJoi.profile().isTimezone(),
  prefix: Joi.string().trim().max(10),
  locale: profileJoi.profile().isLocale()
})

module.exports = profileSchema
