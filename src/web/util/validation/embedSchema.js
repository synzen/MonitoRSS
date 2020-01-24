const Joi = require('@hapi/joi')
const embedJoi = require('./custom/embed.js')

const embedSchema = Joi.object({
  title: Joi.string().allow('').trim().max(256),
  description: Joi.string().allow('').trim().max(2048),
  url: Joi.string().allow('').trim().uri(),
  color: Joi.number().allow('').max(16777215).min(0),
  footerIconUrl: Joi.string().allow('').trim().uri(),
  footerText: Joi.string().allow('').trim().max(2048),
  authorIconUrl: Joi.string().allow('').trim().uri(),
  authorName: Joi.string().allow('').trim().max(256),
  authorUrl: Joi.string().allow('').trim().uri(),
  thumbnailUrl: Joi.string().allow('').trim().uri(),
  imageUrl: Joi.string().allow('').trim().uri(),
  timestamp: embedJoi.embed().isTimestamp(),
  fields: Joi.array().items(Joi.object({
    name: Joi.string().trim().max(256).required(),
    value: Joi.string().trim().max(1024).required(),
    inline: Joi.boolean()
  }))
})

module.exports = embedSchema
