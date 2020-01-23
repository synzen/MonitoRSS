const express = require('express')
const feedsAPI = express.Router()
const rateLimit = require('express-rate-limit')
const validate = require('../../../middleware/validator.js')
const createError = require('../../../util/createError.js')
const controllers = require('../../../controllers/index.js')
const {
  param
} = require('express-validator')

if (process.env.NODE_ENV !== 'test') {
  feedsAPI.use(rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20, // 20 requests per 1 minute
    message: createError(429, 'Too many requests')
  }))
}

feedsAPI.get('/:url', validate([
  param('url', 'Not a valid URL').isURL({
    protocols: ['http', 'https'],
    require_protocol: true
  })
]), controllers.api.feeds.getFeed())

module.exports = feedsAPI
