const express = require('express')
const api = express.Router()
const csrf = require('csurf')
const rateLimit = require('express-rate-limit')
const controllers = require('../../controllers/index.js')
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

api.get('/authenticated', controllers.api.authenticated)
api.use(require('../../middleware/authenticate.js'))
api.use(csrf())
api.get('/cp', controllers.api.cp)
api.use('/feeds', require('./feeds/index.js'))
api.use('/users', require('./users/index.js'))
api.use('/guilds', require('./guilds/index.js'))

module.exports = api
