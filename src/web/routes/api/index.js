const express = require('express')
const api = express.Router()
const csrf = require('csurf')
const rateLimit = require('express-rate-limit')
const controllers = require('../../controllers/index.js')
const createError = require('../../util/createError.js')
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
api.use('/feeds', require('./feeds/index.js'))
api.use('/users', require('./users/index.js'))
api.use('/guilds', require('./guilds/index.js'))

api.use(function errorHandler(err, req, res, next) {
  if (err.error && err.error.isJoi) {
    const type = err.type
    const details = err.error.details
    // we had a joi error, let's return a custom 400 json response
    const strings = []
    for (const detail of details) {
      strings.push(`${detail.message} in ${err.type}`)
    }
    
    const createdError = createError(400, 'Validation error', strings)
    res.status(400).json(createdError);
  } else {
    // pass on to another error handler
    next(err);
  }
});

module.exports = api
