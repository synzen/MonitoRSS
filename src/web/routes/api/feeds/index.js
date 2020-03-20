const express = require('express')
const feedsAPI = express.Router()
const rateLimit = require('express-rate-limit')
const createError = require('../../../util/createError.js')
const controllers = require('../../../controllers/index.js')
const Joi = require('@hapi/joi')
const validator = require('express-joi-validation').createValidator({
  passError: true
})

if (process.env.NODE_ENV !== 'test') {
  feedsAPI.use(rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20, // 20 requests per 1 minute
    message: createError(429, 'Too many requests')
  }))
}

const urlSchema = Joi.object({
  url: Joi.string().uri()
})

feedsAPI.get('/:url', validator.params(urlSchema), controllers.api.feeds.getFeed())

module.exports = feedsAPI
