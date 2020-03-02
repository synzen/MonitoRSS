const Joi = require('@hapi/joi')
const embedSchema = require('./embedSchema.js')
const filterSchema = require('./filterSchema.js')

const feedSchema = Joi.object({
  title: Joi.string().trim().max(256),
  channel: Joi.string().trim(),
  url: Joi.string().uri().trim(),
  checkDates: Joi.boolean(),
  imgPreviews: Joi.boolean(),
  imgLinksExistence: Joi.boolean(),
  formatTables: Joi.boolean(),
  text: Joi.string().allow('').trim().max(2048),
  embeds: Joi.array().items(embedSchema),
  split: Joi.object({
    char: Joi.string().trim().max(10),
    prepend: Joi.string().trim().max(100),
    append: Joi.string().trim().max(100),
    maxLength: Joi.number().max(2048).min(500)
  }),
  filters: filterSchema,
  ncomparisons: Joi.array().max(1).items(Joi.string().valid('title'))
})

module.exports = feedSchema
