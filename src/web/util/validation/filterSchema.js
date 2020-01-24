const Joi = require('@hapi/joi')

module.exports = Joi.object().pattern(/^/, Joi.array().items(Joi.string()))
