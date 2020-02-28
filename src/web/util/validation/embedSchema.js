const Joi = require('@hapi/joi')
const embedJoi = require('./custom/embed.js')
const urlJoi = require('./custom/url.js')

const embedSchema = Joi.object({
  title: Joi.string().allow('').trim().max(256),
  description: Joi.string().allow('').trim().max(2048),
  url: urlJoi.url(),
  color: Joi.number().allow('').max(16777215).min(0),
  footerIconURL: urlJoi.url(),
  footerText: Joi.string().allow('').trim().max(2048),
  authorIconURL: urlJoi.url(),
  authorName: Joi.string().allow('').trim().max(256),
  authorURL: urlJoi.url(),
  thumbnailURL: urlJoi.url(),
  imageURL: urlJoi.url(),
  timestamp: embedJoi.embed().isTimestamp(),
  fields: Joi.array().items(Joi.object({
    name: Joi.string().trim().max(256).required(),
    value: Joi.string().trim().max(1024).required(),
    inline: Joi.boolean()
  }))
})

module.exports = embedSchema
