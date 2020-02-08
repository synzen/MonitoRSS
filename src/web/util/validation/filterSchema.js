const Joi = require('@hapi/joi')

module.exports = Joi.object().pattern(/^/, Joi.alternatives(
  Joi.string().valid(''),
  Joi.array().items(Joi.string().lowercase())
))
