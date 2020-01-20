const express = require('express')
const api = express.Router()
const csrf = require('csurf')
const rateLimit = require('express-rate-limit')

if (process.env.NODE_ENV !== 'test') {
  api.use(rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per 1 minute
    message: {
      code: 429,
      message: 'Too many requests'
    }
  }))
}

api.get('/authenticated', require('../../controllers/api/authenticated.js'))
api.use(csrf())
api.get('/cp', require('../../controllers/api/cp.js'))

module.exports = api
