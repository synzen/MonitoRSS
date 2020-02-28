const Joi = require('@hapi/joi')

module.exports = Joi.extend(joi => {
  return {
    base: joi.alternatives([
      joi.string().allow('').trim().uri(),
      // Placeholders
      joi.string().allow('').trim().pattern(/^{.*}$/)
    ]),
    type: 'url'
  }
})
