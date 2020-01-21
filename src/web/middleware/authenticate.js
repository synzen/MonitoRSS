const log = require('../../util/logger.js')
const authServices = require('../services/auth.js')
const createError = require('../util/createError.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticate (req, res, next) {
  const { token, identity } = req.session
  if (!token) {
    if (identity) {
      log.web.warning(`(${identity.id}, ${identity.username}) Failed Discord Authorization`)
    }
    const error = createError(401, 'Failed discord authorization')
    return res.status(401).json(error)
  }
  try {
    const token = await authServices.getAuthToken(res.app.get('oauth2'), req.session)
    req.session.token = token
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = authenticate
