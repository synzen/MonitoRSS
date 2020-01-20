const logger = require('../../util/logger.js')
const authServices = require('../services/auth.js')
const createError = require('../util/createError.js')

/**
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
function authenticate (req, res, next) {
  if (!req.session.token) {
    if (req.session.identity) {
      log.web.warning(`(${req.session.identity.id}, ${req.session.identity.username}) Failed Discord Authorization`)
    }
    const error = createError(401, 'Failed discord authorization')
    return res.status(401).json(error)
  }
  authServices.getAuthToken(res.app.get('oauth2'), req.session)
    .then(token => {
      req.session.token = token
      next()
    })
    .catch(next)
}

module.exports = authenticate
