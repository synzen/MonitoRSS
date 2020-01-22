const express = require('express')
const feedsAPI = express.Router()
const rateLimit = require('express-rate-limit')
const validate = require('../../../middleware/validator.js')
const createError = require('../../../util/createError.js')
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
]), require('../../../controllers/api/feeds/getFeed.js')())

module.exports = feedsAPI
