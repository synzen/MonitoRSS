const Joi = require('@hapi/joi')
const filtersSchema = require('./filterSchema.js')

// Remember to AND fields
const subscriberSchema = Joi.object({
  type: Joi.string().trim().valid('user', 'role').required(),
  id: Joi.string().trim().required(),
  feed: Joi.string().trim().required(),
  filters: filtersSchema
})

module.exports = subscriberSchema
